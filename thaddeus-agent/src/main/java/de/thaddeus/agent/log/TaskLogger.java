package de.thaddeus.agent.log;

import de.thaddeus.agent.registration.ServerClient;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Buffers log entries per task and flushes them to the server in batches.
 */
@ApplicationScoped
public class TaskLogger {

    private static final Logger log = Logger.getLogger(TaskLogger.class);

    @RestClient
    ServerClient serverClient;

    private final ConcurrentHashMap<String, ConcurrentLinkedQueue<LogBatch.LogEntry>> buffers =
            new ConcurrentHashMap<>();

    public void log(String taskId, String level, String message) {
        buffers.computeIfAbsent(taskId, k -> new ConcurrentLinkedQueue<>())
                .add(new LogBatch.LogEntry(Instant.now(), level, message));
    }

    public void info(String taskId, String message) {
        log(taskId, "INFO", message);
    }

    public void warn(String taskId, String message) {
        log(taskId, "WARN", message);
    }

    public void error(String taskId, String message) {
        log(taskId, "ERROR", message);
    }

    public void flush(String taskId) {
        ConcurrentLinkedQueue<LogBatch.LogEntry> queue = buffers.get(taskId);
        if (queue == null || queue.isEmpty()) return;
        List<LogBatch.LogEntry> entries = new ArrayList<>();
        LogBatch.LogEntry entry;
        while ((entry = queue.poll()) != null) {
            entries.add(entry);
        }
        if (!entries.isEmpty()) {
            try {
                serverClient.sendLogs(taskId, new LogBatch(entries));
            } catch (Exception e) {
                log.warnf("Failed to flush %d log entries for task %s: %s", entries.size(), taskId, e.getMessage());
            }
        }
    }

    public void close(String taskId) {
        flush(taskId);
        buffers.remove(taskId);
    }
}
