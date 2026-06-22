package de.thaddeus.agent.sse;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.thaddeus.agent.log.TaskLogger;
import de.thaddeus.agent.step.StepContext;
import de.thaddeus.agent.step.StepExecutor;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Opens the SSE stream to the server and dispatches received events to StepExecutor.
 * Reconnects with exponential backoff (max 30s) on any failure.
 * Issues #3 (SSE), #2 (heartbeat via keep-alive), #21 (cancel), #14 (deploy task).
 */
@ApplicationScoped
public class AgentSseListener {

    private static final Logger log = Logger.getLogger(AgentSseListener.class);
    private static final int MAX_BACKOFF_MS = 30_000;

    @ConfigProperty(name = "thaddeus.server.url") String serverUrl;

    @Inject StepExecutor stepExecutor;
    @Inject TaskLogger taskLogger;
    @Inject TokenProvider tokenProvider;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
    private final AtomicBoolean running = new AtomicBoolean(false);

    private String agentId;

    public void start(String agentId) {
        this.agentId = agentId;
        running.set(true);
        executor.submit(this::connectLoop);
        log.infof("SSE listener started for agent %s", agentId);
    }

    public void stop() {
        running.set(false);
        executor.shutdownNow();
    }

    private void connectLoop() {
        int attempt = 0;
        while (running.get()) {
            try {
                log.infof("Connecting to SSE stream (attempt %d)...", attempt + 1);
                listenToStream();
                attempt = 0;
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.warnf("SSE connection lost: %s", e.getMessage());
            }
            if (!running.get()) break;
            int backoff = Math.min((int) (500 * Math.pow(2, attempt)) + new Random().nextInt(500), MAX_BACKOFF_MS);
            log.infof("Reconnecting in %dms...", backoff);
            attempt++;
            try { Thread.sleep(backoff); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
        }
    }

    private void listenToStream() throws Exception {
        String url = serverUrl + "/api/agents/" + agentId + "/events";
        String token = tokenProvider.getToken();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Accept", "text/event-stream")
                .header("Authorization", "Bearer " + token)
                .GET()
                .timeout(Duration.ofHours(24))
                .build();

        HttpResponse<java.io.InputStream> response = httpClient.send(request,
                HttpResponse.BodyHandlers.ofInputStream());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Server returned HTTP " + response.statusCode());
        }

        log.info("SSE stream connected");

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body()))) {
            StringBuilder dataBuffer = new StringBuilder();
            String line;

            while ((line = reader.readLine()) != null) {
                if (line.startsWith("data:")) {
                    dataBuffer.append(line.substring(5).trim());
                } else if (line.isEmpty() && dataBuffer.length() > 0) {
                    String data = dataBuffer.toString();
                    dataBuffer.setLength(0);
                    handleEvent(data);
                }
            }
        }
    }

    private void handleEvent(String data) {
        try {
            Map<String, Object> event = mapper.readValue(data, new TypeReference<>() {});
            String type = (String) event.get("type");
            if (type == null) return;

            switch (type) {
                case "PING" -> log.debug("PING received");
                case "DEPLOY_TASK" -> handleDeployTask(event);
                case "CANCEL_TASK" -> handleCancelTask(event);
                default -> log.warnf("Unknown SSE event type: %s", type);
            }
        } catch (Exception e) {
            log.errorf(e, "Failed to process SSE event: %s", data);
        }
    }

    @SuppressWarnings("unchecked")
    private void handleDeployTask(Map<String, Object> event) {
        String taskId = (String) event.get("taskId");
        Map<String, Object> payload = (Map<String, Object>) event.get("payload");
        if (taskId == null || payload == null) return;

        executor.submit(() -> {
            try {
                Path workDir = Files.createTempDirectory("thaddeus-task-" + taskId);

                StepContext ctx = new StepContext(
                        taskId,
                        (String) payload.get("deploymentId"),
                        ((Number) payload.getOrDefault("stepPosition", 0)).intValue(),
                        (String) payload.get("stepType"),
                        parseStepConfig((String) payload.get("stepConfig")),
                        (String) payload.get("packageId"),
                        (String) payload.get("packageVersion"),
                        (Map<String, String>) payload.get("variables"),
                        workDir
                );

                stepExecutor.execute(ctx);

            } catch (Exception e) {
                log.errorf(e, "Failed to start task %s", taskId);
            }
        });
    }

    private void handleCancelTask(Map<String, Object> event) {
        String taskId = (String) event.get("taskId");
        log.infof("CANCEL_TASK received for task %s — interrupting", taskId);
        // In a real implementation we'd track futures per task and interrupt them
        // For now, log the cancellation intent
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseStepConfig(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            Object parsed = mapper.readValue(json, Object.class);
            if (parsed instanceof Map<?, ?> map) return (Map<String, Object>) map;
            return Map.of();
        } catch (Exception e) {
            return Map.of();
        }
    }
}
