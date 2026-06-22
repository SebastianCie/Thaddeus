package de.thaddeus.server.agent;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Sends keep-alive pings to connected agents (every 30s) and marks stale agents
 * OFFLINE if last_seen_at is older than 90 seconds (every 60s).
 */
@ApplicationScoped
public class HeartbeatScheduler {

    private static final Logger log = Logger.getLogger(HeartbeatScheduler.class);

    @Inject SseStreamManager streamManager;

    @Scheduled(every = "30s")
    @Transactional
    void sendPings() {
        streamManager.broadcastPing();
        Agent.refreshLastSeen(streamManager.getConnectedAgentIds());
    }

    @Scheduled(every = "60s")
    @Transactional
    void markStaleAgentsOffline() {
        Instant threshold = Instant.now().minus(90, ChronoUnit.SECONDS);
        long count = Agent.markOfflineIfStale(threshold);
        if (count > 0) {
            log.infof("Marked %d stale agent(s) as OFFLINE", count);
        }
    }
}
