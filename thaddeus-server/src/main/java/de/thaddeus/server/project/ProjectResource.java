package de.thaddeus.server.project;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.thaddeus.server.audit.AuditService;
import de.thaddeus.server.common.EncryptionService;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;

import java.util.List;
import java.util.UUID;

@Path("/api/projects")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ProjectResource {

    @Inject AuditService auditService;
    @Inject SecurityIdentity identity;
    @Inject EncryptionService encryption;
    @Inject ObjectMapper objectMapper;

    // ── Project CRUD (Issue #9) ────────────────────────────────────────────────

    @GET
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public List<Project> list() {
        return Project.listAll(io.quarkus.panache.common.Sort.by("name"));
    }

    @GET
    @Path("/{id}")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public Project get(@PathParam("id") UUID id) {
        Project project = Project.findById(id);
        if (project == null) throw new NotFoundException();
        return project;
    }

    @POST
    @Transactional
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer"})
    public Response create(@Valid Project project, @Context UriInfo uriInfo) {
        project.persist();
        auditService.log(userId(), username(), "CREATE", "project", project.id.toString(), null,
                "{\"name\":\"" + project.name + "\"}");
        return Response.created(uriInfo.getAbsolutePathBuilder().path(project.id.toString()).build())
                .entity(project).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer"})
    public Project update(@PathParam("id") UUID id, @Valid Project update) {
        Project project = Project.findById(id);
        if (project == null) throw new NotFoundException();
        project.name = update.name;
        project.description = update.description;
        project.packageId = update.packageId;
        project.groupId = update.groupId;
        project.lifecycleId = update.lifecycleId;
        auditService.log(userId(), username(), "UPDATE", "project", id.toString(), null, null);
        return project;
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    @RolesAllowed("thaddeus-admin")
    public Response delete(@PathParam("id") UUID id) {
        Project project = Project.findById(id);
        if (project == null) throw new NotFoundException();
        long releaseCount = de.thaddeus.server.release.Release.count("projectId = ?1", id);
        if (releaseCount > 0) {
            return Response.status(409)
                    .entity("{\"error\":\"Project has " + releaseCount + " release(s) and cannot be deleted\"}")
                    .build();
        }
        DeploymentStep.deleteForProject(id);
        ProjectVariable.deleteForProject(id);
        auditService.log(userId(), username(), "DELETE", "project", id.toString(), null,
                "{\"name\":\"" + project.name + "\"}");
        project.delete();
        return Response.noContent().build();
    }

    // ── Deployment Process & Steps (Issue #10) ────────────────────────────────

    @GET
    @Path("/{id}/steps")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public List<DeploymentStep> getSteps(@PathParam("id") UUID id) {
        if (Project.findById(id) == null) throw new NotFoundException();
        return DeploymentStep.forProject(id);
    }

    @PUT
    @Path("/{id}/steps")
    @Transactional
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer"})
    public List<DeploymentStep> replaceSteps(@PathParam("id") UUID id, List<StepRequest> steps) {
        if (Project.findById(id) == null) throw new NotFoundException();
        DeploymentStep.deleteForProject(id);
        for (int i = 0; i < steps.size(); i++) {
            StepRequest req = steps.get(i);
            DeploymentStep step = new DeploymentStep();
            step.projectId = id;
            step.position = i;
            step.type = req.type();
            step.configJson = req.configJson() != null ? req.configJson() : "{}";
            step.targetRoles = req.targetRoles() != null ? req.targetRoles() : List.of();
            step.persist();
        }
        auditService.log(userId(), username(), "UPDATE_STEPS", "project", id.toString(), null,
                "{\"stepCount\":" + steps.size() + "}");
        return DeploymentStep.forProject(id);
    }

    // ── Variables (Issue #11) ─────────────────────────────────────────────────

    @GET
    @Path("/{id}/variables")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public List<VariableView> getVariables(@PathParam("id") UUID id) {
        if (Project.findById(id) == null) throw new NotFoundException();
        return ProjectVariable.forProject(id).stream()
                .map(v -> new VariableView(v.id, v.name,
                        v.isSecret ? "***" : encryption.decrypt(v.valueEncrypted),
                        v.isSecret, v.environmentId))
                .toList();
    }

    @POST
    @Path("/{id}/variables")
    @Transactional
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer"})
    public VariableView createVariable(@PathParam("id") UUID id, VariableRequest req) {
        if (Project.findById(id) == null) throw new NotFoundException();
        ProjectVariable v = new ProjectVariable();
        v.projectId = id;
        v.name = req.name();
        v.valueEncrypted = encryption.encrypt(req.value());
        v.isSecret = req.isSecret();
        v.environmentId = req.environmentId();
        v.persist();
        auditService.log(userId(), username(), "CREATE", "project_variable", v.id.toString(), null,
                "{\"name\":\"" + v.name + "\",\"isSecret\":" + v.isSecret + "}");
        return new VariableView(v.id, v.name, v.isSecret ? "***" : req.value(), v.isSecret, v.environmentId);
    }

    @PUT
    @Path("/{id}/variables/{varId}")
    @Transactional
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer"})
    public VariableView updateVariable(@PathParam("id") UUID id,
                                       @PathParam("varId") UUID varId,
                                       VariableRequest req) {
        ProjectVariable v = ProjectVariable.findById(varId);
        if (v == null || !v.projectId.equals(id)) throw new NotFoundException();
        v.name = req.name();
        v.valueEncrypted = encryption.encrypt(req.value());
        v.isSecret = req.isSecret();
        v.environmentId = req.environmentId();
        auditService.log(userId(), username(), "UPDATE", "project_variable", varId.toString(), null, null);
        return new VariableView(v.id, v.name, v.isSecret ? "***" : req.value(), v.isSecret, v.environmentId);
    }

    @DELETE
    @Path("/{id}/variables/{varId}")
    @Transactional
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer"})
    public Response deleteVariable(@PathParam("id") UUID id, @PathParam("varId") UUID varId) {
        ProjectVariable v = ProjectVariable.findById(varId);
        if (v == null || !v.projectId.equals(id)) throw new NotFoundException();
        auditService.log(userId(), username(), "DELETE", "project_variable", varId.toString(), null, null);
        v.delete();
        return Response.noContent().build();
    }

    private String userId() {
        return identity.isAnonymous() ? "anonymous" : identity.getPrincipal().getName();
    }

    private String username() {
        return identity.isAnonymous() ? null : identity.getPrincipal().getName();
    }

    public record StepRequest(String type, String configJson, List<String> targetRoles) {}
    public record VariableRequest(String name, String value, boolean isSecret, UUID environmentId) {}
    public record VariableView(UUID id, String name, String value, boolean isSecret, UUID environmentId) {}
}
