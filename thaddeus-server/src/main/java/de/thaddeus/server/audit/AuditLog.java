package de.thaddeus.server.audit;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_log")
public class AuditLog extends PanacheEntityBase {

    @Id
    @GeneratedValue
    public UUID id;

    @Column(nullable = false)
    public Instant timestamp = Instant.now();

    @Column(name = "user_id", nullable = false)
    public String userId;

    public String username;

    @Column(nullable = false, length = 100)
    public String action;

    @Column(name = "resource_type", length = 100)
    public String resourceType;

    @Column(name = "resource_id")
    public String resourceId;

    @Column(name = "ip_address", length = 45)
    public String ipAddress;

    @Column(name = "details_json", columnDefinition = "TEXT")
    public String detailsJson;
}
