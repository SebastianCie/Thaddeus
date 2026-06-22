package de.thaddeus.server.deployment;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "deployment_task")
public class DeploymentTask extends PanacheEntityBase {

    @Id
    @GeneratedValue
    public UUID id;

    @Column(name = "deployment_id", nullable = false)
    public UUID deploymentId;

    @Column(name = "agent_id", nullable = false)
    public UUID agentId;

    @Column(name = "step_position", nullable = false)
    public int stepPosition;

    @Column(name = "step_type", nullable = false, length = 100)
    public String stepType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public DeploymentStatus status = DeploymentStatus.PENDING;

    @Column(name = "started_at")
    public Instant startedAt;

    @Column(name = "finished_at")
    public Instant finishedAt;

    public static List<DeploymentTask> forDeployment(UUID deploymentId) {
        return find("deploymentId = ?1",
                io.quarkus.panache.common.Sort.by("stepPosition"), deploymentId).list();
    }

    public static List<DeploymentTask> pendingOrRunning() {
        return find("status = 'PENDING' OR status = 'RUNNING'").list();
    }
}
