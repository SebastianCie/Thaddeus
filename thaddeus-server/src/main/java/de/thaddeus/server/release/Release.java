package de.thaddeus.server.release;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "release")
public class Release extends PanacheEntityBase {

    @Id
    @GeneratedValue
    public UUID id;

    @Column(name = "project_id", nullable = false)
    public UUID projectId;

    @Column(nullable = false, length = 50)
    public String version;

    @Column(name = "package_id", nullable = false)
    public String packageId;

    @Column(name = "package_version", nullable = false, length = 100)
    public String packageVersion;

    @Column(name = "process_snapshot_json", nullable = false, columnDefinition = "TEXT")
    public String processSnapshotJson = "[]";

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();

    public static List<Release> forProject(UUID projectId) {
        return find("projectId = ?1",
                io.quarkus.panache.common.Sort.by("createdAt").descending(), projectId).list();
    }

    public static String nextVersion(UUID projectId) {
        long count = count("projectId = ?1", projectId);
        return "1.0." + count;
    }
}
