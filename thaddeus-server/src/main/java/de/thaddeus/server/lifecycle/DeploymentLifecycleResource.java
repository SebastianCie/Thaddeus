package de.thaddeus.server.lifecycle;

import de.thaddeus.server.audit.AuditService;
import de.thaddeus.server.environment.Environment;
import de.thaddeus.server.project.Project;
import io.quarkus.panache.common.Sort;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Path("/api/lifecycles")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DeploymentLifecycleResource {

    @Inject EntityManager em;
    @Inject AuditService auditService;
    @Inject SecurityIdentity identity;

    @GET
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public List<LifecycleListView> list() {
        return DeploymentLifecycle.<DeploymentLifecycle>listAll(Sort.by("name")).stream()
                .map(lc -> new LifecycleListView(
                        lc.id, lc.name, lc.description,
                        lc.phases.size(),
                        Project.count("lifecycleId", lc.id),
                        lc.createdAt, lc.updatedAt))
                .toList();
    }

    @GET
    @Path("/{id}")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public DeploymentLifecycle get(@PathParam("id") UUID id) {
        DeploymentLifecycle lc = DeploymentLifecycle.findById(id);
        if (lc == null) throw new NotFoundException();
        return lc;
    }

    @POST
    @Transactional
    @RolesAllowed("thaddeus-admin")
    public Response create(LifecycleRequest req, @Context UriInfo uriInfo) {
        DeploymentLifecycle lc = new DeploymentLifecycle();
        lc.name = req.name();
        lc.description = req.description();
        lc.persist();
        applyPhases(lc, req.phases());
        auditService.log(userId(), username(), "CREATE", "lifecycle", lc.id.toString(), null,
                "{\"name\":\"" + lc.name + "\"}");
        return Response.created(uriInfo.getAbsolutePathBuilder().path(lc.id.toString()).build())
                .entity(lc).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    @RolesAllowed("thaddeus-admin")
    public DeploymentLifecycle update(@PathParam("id") UUID id, LifecycleRequest req) {
        DeploymentLifecycle lc = DeploymentLifecycle.findById(id);
        if (lc == null) throw new NotFoundException();
        lc.name = req.name();
        lc.description = req.description();
        lc.updatedAt = Instant.now();
        lc.phases.clear();
        em.flush();
        applyPhases(lc, req.phases());
        auditService.log(userId(), username(), "UPDATE", "lifecycle", id.toString(), null, null);
        return lc;
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    @RolesAllowed("thaddeus-admin")
    public Response delete(@PathParam("id") UUID id) {
        DeploymentLifecycle lc = DeploymentLifecycle.findById(id);
        if (lc == null) throw new NotFoundException();
        long projectCount = Project.count("lifecycleId", id);
        if (projectCount > 0) {
            throw new WebApplicationException(
                    Response.status(409).entity(
                            "{\"error\":\"Lifecycle is used by " + projectCount + " project(s) and cannot be deleted\"}"
                    ).build());
        }
        auditService.log(userId(), username(), "DELETE", "lifecycle", id.toString(), null,
                "{\"name\":\"" + lc.name + "\"}");
        lc.delete();
        return Response.noContent().build();
    }

    private void applyPhases(DeploymentLifecycle lc, List<PhaseRequest> requests) {
        if (requests == null) return;
        for (int i = 0; i < requests.size(); i++) {
            PhaseRequest pr = requests.get(i);
            LifecyclePhase phase = new LifecyclePhase();
            phase.lifecycle = lc;
            phase.name = pr.name();
            phase.position = i;
            phase.optional = pr.optional();
            phase.autoDeploy = pr.autoDeploy();
            if (pr.environmentIds() != null) {
                for (UUID envId : pr.environmentIds()) {
                    Environment env = Environment.findById(envId);
                    if (env != null) phase.environments.add(env);
                }
            }
            lc.phases.add(phase);
        }
    }

    private String userId()   { return identity.isAnonymous() ? "anonymous" : identity.getPrincipal().getName(); }
    private String username() { return identity.isAnonymous() ? null : identity.getPrincipal().getName(); }

    public record LifecycleRequest(String name, String description, List<PhaseRequest> phases) {}
    public record PhaseRequest(String name, boolean optional, boolean autoDeploy, List<UUID> environmentIds) {}
    public record LifecycleListView(UUID id, String name, String description, int phaseCount, long projectCount,
                                    Instant createdAt, Instant updatedAt) {}
}
