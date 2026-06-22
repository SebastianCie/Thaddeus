package de.thaddeus.server.environment;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "environment")
public class Environment extends PanacheEntityBase {

    @Id
    @GeneratedValue
    public UUID id;

    @NotBlank
    @Size(max = 100)
    @Column(nullable = false, unique = true)
    public String name;

    @Column(columnDefinition = "TEXT")
    public String description;

    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$")
    @Column(nullable = false, length = 7)
    public String color = "#6366f1";

    @Column(name = "created_at", nullable = false)
    public Instant createdAt = Instant.now();
}
