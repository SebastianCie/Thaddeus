package de.thaddeus.server.agent;

import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.subscription.MultiEmitter;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages live SSE emitters, one per connected agent.
 * Thread-safe; an agent may reconnect while the old emitter is still draining.
 */
@ApplicationScoped
public class SseStreamManager {

    private static final Logger log = Logger.getLogger(SseStreamManager.class);

    private final Map<UUID, MultiEmitter<? super AgentEvent>> emitters = new ConcurrentHashMap<>();

    public Multi<AgentEvent> openStream(UUID agentId) {
        return Multi.createFrom().emitter(emitter -> {
            MultiEmitter<? super AgentEvent> previous = emitters.put(agentId, emitter);
            if (previous != null) {
                previous.complete();
            }
            log.infof("SSE stream opened for agent %s", agentId);
            emitter.onTermination(() -> {
                emitters.remove(agentId, emitter);
                log.infof("SSE stream closed for agent %s", agentId);
            });
        });
    }

    public boolean send(UUID agentId, AgentEvent event) {
        MultiEmitter<? super AgentEvent> emitter = emitters.get(agentId);
        if (emitter != null && !emitter.isCancelled()) {
            emitter.emit(event);
            return true;
        }
        return false;
    }

    public boolean isConnected(UUID agentId) {
        MultiEmitter<? super AgentEvent> emitter = emitters.get(agentId);
        return emitter != null && !emitter.isCancelled();
    }

    public int connectedCount() {
        return emitters.size();
    }

    public void broadcastPing() {
        AgentEvent ping = AgentEvent.ping();
        emitters.forEach((id, emitter) -> {
            if (!emitter.isCancelled()) {
                emitter.emit(ping);
            }
        });
    }

    public Set<UUID> getConnectedAgentIds() {
        return emitters.keySet();
    }

    public void closeStream(UUID agentId) {
        MultiEmitter<? super AgentEvent> emitter = emitters.remove(agentId);
        if (emitter != null) {
            emitter.complete();
        }
    }
}
