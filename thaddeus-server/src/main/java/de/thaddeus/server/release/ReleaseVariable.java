package de.thaddeus.server.release;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;

import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "release_variable")
public class ReleaseVariable extends PanacheEntityBase {

    @Id
    @GeneratedValue
    public UUID id;

    @Column(name = "release_id", nullable = false)
    public UUID releaseId;

    @Column(nullable = false, length = 255)
    public String name;

    @Column(name = "value_encrypted", nullable = false, columnDefinition = "TEXT")
    public String valueEncrypted;

    @Column(name = "is_secret", nullable = false)
    public boolean isSecret = false;

    @Column(name = "environment_id")
    public UUID environmentId;

    public static List<ReleaseVariable> forRelease(UUID releaseId) {
        return find("releaseId = ?1", io.quarkus.panache.common.Sort.by("name"), releaseId).list();
    }
}
