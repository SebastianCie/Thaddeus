package de.thaddeus.server.agent;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

@Entity
@Table(name = "role")
public class AgentRole extends PanacheEntityBase {

    @Id
    @GeneratedValue
    public UUID id;

    @NotBlank
    @Column(nullable = false, unique = true, length = 100)
    public String name;

    public static AgentRole findOrCreate(String name) {
        return find("name", name).firstResultOptional()
                .orElseGet(() -> {
                    AgentRole r = new AgentRole();
                    r.name = name;
                    r.persist();
                    return r;
                });
    }
}
