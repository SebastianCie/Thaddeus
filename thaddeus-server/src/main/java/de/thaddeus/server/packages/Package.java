package de.thaddeus.server.packages;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import io.quarkus.panache.common.Sort;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "package")
public class Package extends PanacheEntityBase {

    @Id
    @GeneratedValue
    public UUID id;

    @Column(name = "package_id", nullable = false)
    public String packageId;

    @Column(nullable = false, length = 100)
    public String version;

    @Column(nullable = false)
    public String filename;

    @Column(nullable = false, length = 1000)
    public String path;

    @Column(name = "size_bytes", nullable = false)
    public long sizeBytes;

    @Column(nullable = false, length = 64)
    public String sha256;

    @Column(name = "uploaded_at", nullable = false)
    public Instant uploadedAt = Instant.now();

    public static List<Package> search(String search, int page, int size) {
        String query = search != null && !search.isBlank()
                ? "packageId LIKE :search"
                : "1=1";
        var params = new java.util.HashMap<String, Object>();
        if (search != null && !search.isBlank()) {
            params.put("search", search + "%");
        }
        return find(query, Sort.by("packageId").and("version").descending(), params)
                .page(page, size).list();
    }

    public static List<Package> versionsOf(String packageId) {
        return find("packageId = ?1", Sort.by("uploadedAt").descending(), packageId).list();
    }

    public static boolean exists(String packageId, String version) {
        return count("packageId = ?1 AND version = ?2", packageId, version) > 0;
    }

    public static Package findByIdAndVersion(String packageId, String version) {
        return find("packageId = ?1 AND version = ?2", packageId, version).firstResult();
    }
}
