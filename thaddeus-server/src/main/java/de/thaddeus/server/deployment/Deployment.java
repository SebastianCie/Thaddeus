package de.thaddeus.server.deployment;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "deployment")
public class Deployment extends PanacheEntityBase {

    @Id
    @GeneratedValue
    public UUID id;

    @Column(name = "release_id", nullable = false)
    public UUID releaseId;

    @Column(name = "environment_id", nullable = false)
    public UUID environmentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public DeploymentStatus status = DeploymentStatus.PENDING;

    @Column(name = "created_by")
    public String createdBy;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    @Column(name = "finished_at")
    public Instant finishedAt;

    public static List<Deployment> recent(int limit) {
        return findAll(io.quarkus.panache.common.Sort.by("createdAt").descending())
                .page(0, limit).list();
    }
}
