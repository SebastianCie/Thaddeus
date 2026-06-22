package de.thaddeus.server.packages;

import de.thaddeus.server.audit.AuditService;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Path("/api/packages")
@Produces(MediaType.APPLICATION_JSON)
public class PackageResource {

    @ConfigProperty(name = "thaddeus.packages.root") String packagesRoot;
    @ConfigProperty(name = "thaddeus.packages.max-size-mb", defaultValue = "500") int maxSizeMb;

    @Inject AuditService auditService;
    @Inject SecurityIdentity identity;

    // ── Upload NuGet package (Issue #6) ───────────────────────────────────────

    @PUT
    @Path("/{packageId}/{version}")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Transactional
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer"})
    public Response upload(
            @PathParam("packageId") String packageId,
            @PathParam("version") String version,
            @RestForm("file") FileUpload file) throws IOException {

        if (Package.exists(packageId, version)) {
            return Response.status(409)
                    .entity("{\"error\":\"Package " + packageId + " " + version + " already exists\"}")
                    .build();
        }

        long maxBytes = (long) maxSizeMb * 1024 * 1024;
        if (file.size() > maxBytes) {
            return Response.status(413)
                    .entity("{\"error\":\"File exceeds maximum size of " + maxSizeMb + " MB\"}")
                    .build();
        }

        java.nio.file.Path dest = java.nio.file.Path.of(packagesRoot, packageId, version, file.fileName());
        Files.createDirectories(dest.getParent());
        Files.copy(file.uploadedFile(), dest, StandardCopyOption.REPLACE_EXISTING);

        String sha256 = computeSha256(dest);

        Package pkg = new Package();
        pkg.packageId = packageId;
        pkg.version = version;
        pkg.filename = file.fileName();
        pkg.path = dest.toString();
        pkg.sizeBytes = Files.size((java.nio.file.Path) dest);
        pkg.sha256 = sha256;
        pkg.persist();

        auditService.log(userId(), username(), "UPLOAD_PACKAGE", "package", pkg.id.toString(), null,
                "{\"packageId\":\"" + packageId + "\",\"version\":\"" + version + "\"}");

        return Response.created(null).entity(pkg).build();
    }

    // ── List & search (Issue #7) ──────────────────────────────────────────────

    @GET
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public List<Package> list(
            @QueryParam("search") String search,
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("20") int size) {
        return Package.search(search, page, size);
    }

    @GET
    @Path("/{packageId}/versions")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public List<Package> versions(@PathParam("packageId") String packageId) {
        return Package.versionsOf(packageId);
    }

    // ── Delete (Issue #8) ─────────────────────────────────────────────────────

    @DELETE
    @Path("/{packageId}/{version}")
    @Transactional
    @RolesAllowed("thaddeus-admin")
    public Response delete(@PathParam("packageId") String packageId,
                           @PathParam("version") String version) throws IOException {
        Package pkg = Package.findByIdAndVersion(packageId, version);
        if (pkg == null) throw new NotFoundException();

        long refCount = de.thaddeus.server.release.Release.count(
                "packageId = ?1 AND packageVersion = ?2", packageId, version);
        if (refCount > 0) {
            return Response.status(409)
                    .entity("{\"error\":\"Package is referenced by " + refCount + " release(s)\"}")
                    .build();
        }

        Files.deleteIfExists(java.nio.file.Path.of(pkg.path));

        auditService.log(userId(), username(), "DELETE_PACKAGE", "package", pkg.id.toString(), null,
                "{\"packageId\":\"" + packageId + "\",\"version\":\"" + version + "\"}");

        pkg.delete();
        return Response.noContent().build();
    }

    @GET
    @Path("/{packageId}/{version}/download")
    @Produces(MediaType.APPLICATION_OCTET_STREAM)
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer"})
    public Response download(@PathParam("packageId") String packageId,
                             @PathParam("version") String version) {
        Package pkg = Package.findByIdAndVersion(packageId, version);
        if (pkg == null) throw new NotFoundException();
        java.io.File file = new java.io.File(pkg.path);
        if (!file.exists()) throw new NotFoundException("Package file not found on disk");
        return Response.ok(file)
                .header("Content-Disposition", "attachment; filename=\"" + pkg.filename + "\"")
                .build();
    }

    private String computeSha256(java.nio.file.Path file) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = Files.readAllBytes(file);
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (Exception e) {
            throw new IOException("SHA-256 computation failed", e);
        }
    }

    private String userId() {
        return identity.isAnonymous() ? "anonymous" : identity.getPrincipal().getName();
    }

    private String username() {
        return identity.isAnonymous() ? null : identity.getPrincipal().getName();
    }
}
