package de.thaddeus.server.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.thaddeus.server.audit.AuditService;
import de.thaddeus.server.environment.Environment;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Multi;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.RestStreamElementType;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Path("/api/agents")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AgentResource {

    @Inject SseStreamManager streamManager;
    @Inject AuditService auditService;
    @Inject SecurityIdentity identity;
    @Inject ObjectMapper objectMapper;

    // ── Registration (Issue #1) ──────────────────────────────────────────────

    @POST
    @Path("/register")
    @Transactional
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer"})
    public Response register(RegisterRequest req) {
        Agent agent = (Agent) Agent.find("hostname", req.hostname()).firstResult();
        if (agent == null) agent = new Agent();
        agent.hostname = req.hostname();
        agent.ip = req.ip();
        agent.osVersion = req.osVersion();
        agent.agentVersion = req.agentVersion();
        agent.status = AgentStatus.ONLINE;
        agent.lastSeenAt = Instant.now();
        if (agent.id == null) {
            agent.registeredAt = Instant.now();
            agent.persist();
            auditService.log(userId(), username(), "REGISTER", "agent", agent.hostname, null,
                    "{\"hostname\":\"" + req.hostname() + "\"}");
        }
        return Response.ok(agent).build();
    }

    // ── SSE stream (Issues #2, #3) ───────────────────────────────────────────

    @GET
    @Path("/{id}/events")
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @RestStreamElementType(MediaType.APPLICATION_JSON)
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer"})
    @Transactional
    public Multi<AgentEvent> events(@PathParam("id") UUID id) {
        Agent agent = Agent.findById(id);
        if (agent == null) throw new NotFoundException();
        agent.status = AgentStatus.ONLINE;
        agent.lastSeenAt = Instant.now();
        return streamManager.openStream(id);
    }

    // ── Agent list & status (Issue #2 UI) ────────────────────────────────────

    @GET
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public List<Agent> list() {
        return Agent.listAll(io.quarkus.panache.common.Sort.by("hostname"));
    }

    @GET
    @Path("/{id}")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public Agent get(@PathParam("id") UUID id) {
        Agent agent = Agent.findById(id);
        if (agent == null) throw new NotFoundException();
        return agent;
    }

    // ── Deployment Targets: assign environment & roles (Issue #5) ────────────

    @PUT
    @Path("/{id}/targets")
    @Transactional
    @RolesAllowed("thaddeus-admin")
    public Agent assignTargets(@PathParam("id") UUID id, TargetAssignment assignment) {
        Agent agent = Agent.findById(id);
        if (agent == null) throw new NotFoundException();

        agent.agentEnvironments.clear();
        if (assignment.environmentIds() != null) {
            for (UUID envId : assignment.environmentIds()) {
                Environment env = Environment.findById(envId);
                if (env != null) agent.agentEnvironments.add(env);
            }
        }

        agent.agentRoles.clear();
        if (assignment.roleNames() != null) {
            for (String roleName : assignment.roleNames()) {
                agent.agentRoles.add(AgentRole.findOrCreate(roleName));
            }
        }

        auditService.log(userId(), username(), "UPDATE_TARGETS", "agent", id.toString(), null, null);
        return agent;
    }

    private String userId() {
        return identity.isAnonymous() ? "anonymous" : identity.getPrincipal().getName();
    }

    private String username() {
        return identity.isAnonymous() ? null : identity.getPrincipal().getName();
    }

    public record RegisterRequest(String hostname, String ip, String osVersion, String agentVersion) {}
    public record TargetAssignment(Set<UUID> environmentIds, Set<String> roleNames) {}
}
