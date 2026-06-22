package de.thaddeus.server.agent;

import de.thaddeus.server.environment.Environment;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "agent")
public class Agent extends PanacheEntityBase {

    @Id
    @GeneratedValue
    public UUID id;

    @NotBlank
    @Column(nullable = false, unique = true)
    public String hostname;

    @Column(length = 45)
    public String ip;

    @Column(name = "os_version")
    public String osVersion;

    @Column(name = "agent_version", length = 50)
    public String agentVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public AgentStatus status = AgentStatus.OFFLINE;

    @Column(name = "registered_at", nullable = false)
    public Instant registeredAt = Instant.now();

    @Column(name = "last_seen_at", nullable = false)
    public Instant lastSeenAt = Instant.now();

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "agent_environment",
            joinColumns = @JoinColumn(name = "agent_id"),
            inverseJoinColumns = @JoinColumn(name = "environment_id")
    )
    public Set<Environment> agentEnvironments = new HashSet<>();

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "agent_role",
            joinColumns = @JoinColumn(name = "agent_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    public Set<AgentRole> agentRoles = new HashSet<>();

    public static List<Agent> findByEnvironmentAndRole(UUID environmentId, String roleName) {
        return find("""
                SELECT DISTINCT a FROM Agent a
                JOIN a.agentEnvironments ae
                JOIN a.agentRoles ar
                WHERE ae.id = ?1 AND ar.name = ?2 AND a.status = 'ONLINE'
                """, environmentId, roleName).list();
    }

    public static List<Agent> findByEnvironment(UUID environmentId) {
        return find("""
                SELECT DISTINCT a FROM Agent a
                JOIN a.agentEnvironments ae
                WHERE ae.id = ?1 AND a.status = 'ONLINE'
                """, environmentId).list();
    }

    public static long markOfflineIfStale(Instant threshold) {
        return update(
                "status = 'OFFLINE' WHERE status = 'ONLINE' AND lastSeenAt < ?1",
                threshold);
    }

    public static void refreshLastSeen(Set<UUID> ids) {
        if (ids.isEmpty()) return;
        update("lastSeenAt = ?1 WHERE id IN ?2", Instant.now(), ids);
    }
}
