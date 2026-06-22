package de.thaddeus.server.deployment;

import de.thaddeus.server.audit.AuditService;
import de.thaddeus.server.task.TaskLog;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Path("/api")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DeploymentResource {

    @Inject DeploymentService deploymentService;
    @Inject AuditService auditService;
    @Inject SecurityIdentity identity;

    // ── Trigger deployment (Issue #14) ────────────────────────────────────────

    @POST
    @Path("/releases/{releaseId}/deployments")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer"})
    public Response trigger(@PathParam("releaseId") UUID releaseId, TriggerRequest req) throws Exception {
        Deployment deployment = deploymentService.triggerDeployment(releaseId, req.environmentId(), userId());
        auditService.log(userId(), username(), "TRIGGER_DEPLOYMENT", "deployment",
                deployment.id.toString(), null,
                "{\"releaseId\":\"" + releaseId + "\",\"environmentId\":\"" + req.environmentId() + "\"}");
        return Response.ok(deployment).build();
    }

    // ── List deployments ──────────────────────────────────────────────────────

    @GET
    @Path("/deployments")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public List<Deployment> list(
            @QueryParam("limit") @DefaultValue("50") int limit) {
        return Deployment.recent(limit);
    }

    @GET
    @Path("/deployments/{id}")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public Deployment get(@PathParam("id") UUID id) {
        Deployment d = Deployment.findById(id);
        if (d == null) throw new NotFoundException();
        return d;
    }

    @GET
    @Path("/deployments/{id}/tasks")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public List<DeploymentTask> tasks(@PathParam("id") UUID id) {
        if (Deployment.findById(id) == null) throw new NotFoundException();
        return DeploymentTask.forDeployment(id);
    }

    // ── Cancel deployment (Issue #21) ─────────────────────────────────────────

    @POST
    @Path("/deployments/{id}/cancel")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer"})
    public Response cancel(@PathParam("id") UUID id) {
        deploymentService.cancelDeployment(id);
        auditService.log(userId(), username(), "CANCEL_DEPLOYMENT", "deployment", id.toString(), null, null);
        return Response.ok().build();
    }

    // ── Task logs (Issue #20) — agent pushes logs here ────────────────────────

    @POST
    @Path("/tasks/{taskId}/logs")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer"})
    @Transactional
    public Response appendLogs(@PathParam("taskId") UUID taskId, List<LogEntry> entries) {
        if (DeploymentTask.findById(taskId) == null) throw new NotFoundException();
        for (LogEntry entry : entries) {
            TaskLog log = new TaskLog();
            log.taskId = taskId;
            log.loggedAt = entry.timestamp() != null ? entry.timestamp() : Instant.now();
            log.level = entry.level() != null ? entry.level() : "INFO";
            log.message = entry.message();
            log.persist();
        }
        return Response.accepted().build();
    }

    @GET
    @Path("/tasks/{taskId}/logs")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public List<TaskLog> getLogs(@PathParam("taskId") UUID taskId,
                                  @QueryParam("since") String sinceStr) {
        if (DeploymentTask.findById(taskId) == null) throw new NotFoundException();
        Instant since = sinceStr != null ? Instant.parse(sinceStr) : null;
        return TaskLog.forTask(taskId, since);
    }

    // ── Task status update (agent reports back) ───────────────────────────────

    @PUT
    @Path("/tasks/{taskId}/status")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer"})
    @Transactional
    public Response updateTaskStatus(@PathParam("taskId") UUID taskId, TaskStatusUpdate update) {
        DeploymentTask task = DeploymentTask.findById(taskId);
        if (task == null) throw new NotFoundException();
        task.status = update.status();
        if (task.status == DeploymentStatus.RUNNING && task.startedAt == null) {
            task.startedAt = Instant.now();
        }
        if (task.status == DeploymentStatus.SUCCESS
                || task.status == DeploymentStatus.FAILED
                || task.status == DeploymentStatus.CANCELLED) {
            task.finishedAt = Instant.now();
            updateDeploymentStatus(task.deploymentId);
        }
        return Response.ok(task).build();
    }

    private void updateDeploymentStatus(UUID deploymentId) {
        List<DeploymentTask> tasks = DeploymentTask.forDeployment(deploymentId);
        boolean anyRunning = tasks.stream().anyMatch(t -> t.status == DeploymentStatus.RUNNING || t.status == DeploymentStatus.PENDING);
        boolean anyFailed = tasks.stream().anyMatch(t -> t.status == DeploymentStatus.FAILED);
        boolean anyCancelled = tasks.stream().anyMatch(t -> t.status == DeploymentStatus.CANCELLED);
        boolean allDone = tasks.stream().allMatch(t -> t.status != DeploymentStatus.RUNNING && t.status != DeploymentStatus.PENDING);

        Deployment deployment = Deployment.findById(deploymentId);
        if (deployment == null) return;
        if (!anyRunning && allDone) {
            if (anyCancelled) deployment.status = DeploymentStatus.CANCELLED;
            else if (anyFailed) deployment.status = DeploymentStatus.FAILED;
            else deployment.status = DeploymentStatus.SUCCESS;
            deployment.finishedAt = Instant.now();
        }
    }

    private String userId() {
        return identity.isAnonymous() ? "anonymous" : identity.getPrincipal().getName();
    }

    private String username() {
        return identity.isAnonymous() ? null : identity.getPrincipal().getName();
    }

    public record TriggerRequest(UUID environmentId) {}
    public record LogEntry(Instant timestamp, String level, String message) {}
    public record TaskStatusUpdate(DeploymentStatus status) {}
}
