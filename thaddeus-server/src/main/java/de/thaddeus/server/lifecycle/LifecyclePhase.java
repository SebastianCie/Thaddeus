package de.thaddeus.server.lifecycle;

import com.fasterxml.jackson.annotation.JsonIgnore;
import de.thaddeus.server.environment.Environment;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "lifecycle_phase")
public class LifecyclePhase extends PanacheEntityBase {

    @Id
    @GeneratedValue
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lifecycle_id", nullable = false)
    @JsonIgnore
    public DeploymentLifecycle lifecycle;

    @Column(nullable = false)
    public String name;

    @Column(nullable = false)
    public int position;

    @Column(nullable = false)
    public boolean optional = false;

    @Column(name = "auto_deploy", nullable = false)
    public boolean autoDeploy = false;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "lifecycle_phase_environment",
            joinColumns = @JoinColumn(name = "phase_id"),
            inverseJoinColumns = @JoinColumn(name = "environment_id")
    )
    public Set<Environment> environments = new HashSet<>();
}
