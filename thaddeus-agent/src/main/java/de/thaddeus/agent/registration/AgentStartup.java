package de.thaddeus.agent.registration;

import de.thaddeus.agent.sse.AgentSseListener;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

import java.net.InetAddress;
import java.util.Map;

/**
 * Registers this agent with the server on startup, then opens the SSE stream. Issue #1.
 */
@ApplicationScoped
public class AgentStartup {

    private static final Logger log = Logger.getLogger(AgentStartup.class);
    private static final String AGENT_VERSION = "1.0.0";

    @RestClient
    ServerClient serverClient;

    @Inject AgentSseListener sseListener;

    void onStart(@Observes StartupEvent event) {
        try {
            InetAddress local = InetAddress.getLocalHost();
            String hostname = local.getHostName();
            String ip = local.getHostAddress();
            String os = System.getProperty("os.name") + " " + System.getProperty("os.version");

            log.infof("Registering agent: hostname=%s ip=%s os=%s", hostname, ip, os);

            Map<String, Object> response = serverClient.register(
                    new RegisterRequest(hostname, ip, os, AGENT_VERSION));

            Object idObj = response.get("id");
            if (idObj == null) {
                log.error("Server did not return agent id — cannot start SSE listener");
                return;
            }

            String agentId = idObj.toString();
            log.infof("Agent registered with id: %s", agentId);

            sseListener.start(agentId);

        } catch (Exception e) {
            log.errorf(e, "Agent registration failed: %s", e.getMessage());
        }
    }
}
