package de.thaddeus.server.release;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.thaddeus.server.audit.AuditService;
import de.thaddeus.server.common.EncryptionService;
import de.thaddeus.server.project.DeploymentStep;
import de.thaddeus.server.project.Project;
import de.thaddeus.server.project.ProjectVariable;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import org.jboss.logging.Logger;

import java.util.List;
import java.util.UUID;

@Path("/api/projects/{projectId}/releases")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ReleaseResource {

    private static final Logger log = Logger.getLogger(ReleaseResource.class);

    @Inject AuditService auditService;
    @Inject SecurityIdentity identity;
    @Inject EncryptionService encryption;
    @Inject ObjectMapper objectMapper;

    @GET
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public List<Release> list(@PathParam("projectId") UUID projectId) {
        if (Project.findById(projectId) == null) throw new NotFoundException();
        return Release.forProject(projectId);
    }

    @GET
    @Path("/{releaseId}")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public Release get(@PathParam("projectId") UUID projectId,
                       @PathParam("releaseId") UUID releaseId) {
        Release release = Release.findById(releaseId);
        if (release == null || !release.projectId.equals(projectId)) throw new NotFoundException();
        return release;
    }

    /**
     * Creates a release with an immutable snapshot of the current deployment process and variables.
     * Issues #12 + #13.
     */
    @POST
    @Transactional
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer"})
    public Response create(@PathParam("projectId") UUID projectId,
                           CreateReleaseRequest req,
                           @Context UriInfo uriInfo) throws Exception {
        Project project = Project.findById(projectId);
        if (project == null) throw new NotFoundException();

        // Snapshot the deployment process
        List<DeploymentStep> steps = DeploymentStep.forProject(projectId);
        String processSnapshot = objectMapper.writeValueAsString(steps);

        Release release = new Release();
        release.projectId = projectId;
        release.version = Release.nextVersion(projectId);
        release.packageId = req.packageId() != null ? req.packageId() : project.packageId;
        release.packageVersion = req.packageVersion();
        release.processSnapshotJson = processSnapshot;
        release.persist();

        // Snapshot all variables (Issue #13)
        List<ProjectVariable> variables = ProjectVariable.forProject(projectId);
        for (ProjectVariable pv : variables) {
            ReleaseVariable rv = new ReleaseVariable();
            rv.releaseId = release.id;
            rv.name = pv.name;
            rv.valueEncrypted = pv.valueEncrypted;
            rv.isSecret = pv.isSecret;
            rv.environmentId = pv.environmentId;
            rv.persist();
        }

        auditService.log(userId(), username(), "CREATE", "release", release.id.toString(), null,
                "{\"projectId\":\"" + projectId + "\",\"version\":\"" + release.version
                        + "\",\"packageVersion\":\"" + release.packageVersion + "\"}");

        return Response.created(uriInfo.getAbsolutePathBuilder().path(release.id.toString()).build())
                .entity(release).build();
    }

    @GET
    @Path("/{releaseId}/variables")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public List<VariableView> getVariables(@PathParam("projectId") UUID projectId,
                                           @PathParam("releaseId") UUID releaseId) {
        Release release = Release.findById(releaseId);
        if (release == null || !release.projectId.equals(projectId)) throw new NotFoundException();
        return ReleaseVariable.forRelease(releaseId).stream()
                .map(v -> new VariableView(v.id, v.name,
                        v.isSecret ? "***" : encryption.decrypt(v.valueEncrypted),
                        v.isSecret, v.environmentId))
                .toList();
    }

    private String userId() {
        return identity.isAnonymous() ? "anonymous" : identity.getPrincipal().getName();
    }

    private String username() {
        return identity.isAnonymous() ? null : identity.getPrincipal().getName();
    }

    public record CreateReleaseRequest(String packageId, String packageVersion) {}
    public record VariableView(UUID id, String name, String value, boolean isSecret, UUID environmentId) {}
}
