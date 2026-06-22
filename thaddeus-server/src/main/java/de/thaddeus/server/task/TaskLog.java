package de.thaddeus.server.task;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "task_log")
public class TaskLog extends PanacheEntityBase {

    @Id
    @GeneratedValue
    public UUID id;

    @Column(name = "task_id", nullable = false)
    public UUID taskId;

    @Column(name = "logged_at", nullable = false)
    public Instant loggedAt = Instant.now();

    @Column(nullable = false, length = 10)
    public String level = "INFO";

    @Column(nullable = false, columnDefinition = "TEXT")
    public String message;

    public static List<TaskLog> forTask(UUID taskId, Instant since) {
        if (since != null) {
            return find("taskId = ?1 AND loggedAt > ?2",
                    io.quarkus.panache.common.Sort.by("loggedAt"), taskId, since).list();
        }
        return find("taskId = ?1",
                io.quarkus.panache.common.Sort.by("loggedAt"), taskId).list();
    }
}
