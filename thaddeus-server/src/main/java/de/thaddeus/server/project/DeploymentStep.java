package de.thaddeus.server.project;

import de.thaddeus.server.common.StringListConverter;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "deployment_step")
public class DeploymentStep extends PanacheEntityBase {

    @Id
    @GeneratedValue
    public UUID id;

    @NotNull
    @Column(name = "project_id", nullable = false)
    public UUID projectId;

    @Column(nullable = false)
    public int position;

    @NotBlank
    @Column(nullable = false, length = 100)
    public String type;

    @Column(name = "config_json", columnDefinition = "TEXT")
    public String configJson = "{}";

    @Convert(converter = StringListConverter.class)
    @Column(name = "target_roles", columnDefinition = "TEXT")
    public List<String> targetRoles = new ArrayList<>();

    public static List<DeploymentStep> forProject(UUID projectId) {
        return find("projectId = ?1", io.quarkus.panache.common.Sort.by("position"), projectId).list();
    }

    public static void deleteForProject(UUID projectId) {
        delete("projectId = ?1", projectId);
    }
}
