package de.thaddeus.server.project;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;

import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "project_variable")
public class ProjectVariable extends PanacheEntityBase {

    @Id
    @GeneratedValue
    public UUID id;

    @Column(name = "project_id", nullable = false)
    public UUID projectId;

    @Column(nullable = false, length = 255)
    public String name;

    @Column(name = "value_encrypted", nullable = false, columnDefinition = "TEXT")
    public String valueEncrypted;

    @Column(name = "is_secret", nullable = false)
    public boolean isSecret = false;

    @Column(name = "environment_id")
    public UUID environmentId;

    public static List<ProjectVariable> forProject(UUID projectId) {
        return find("projectId = ?1", io.quarkus.panache.common.Sort.by("name"), projectId).list();
    }

    public static void deleteForProject(UUID projectId) {
        delete("projectId = ?1", projectId);
    }
}
