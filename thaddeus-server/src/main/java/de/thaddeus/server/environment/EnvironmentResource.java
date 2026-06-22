package de.thaddeus.server.environment;

import de.thaddeus.server.agent.Agent;
import de.thaddeus.server.audit.AuditService;
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

@Path("/api/environments")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class EnvironmentResource {

    @Inject AuditService auditService;
    @Inject SecurityIdentity identity;

    @GET
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public List<Environment> list() {
        return Environment.listAll(io.quarkus.panache.common.Sort.by("name"));
    }

    @GET
    @Path("/{id}")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public Environment get(@PathParam("id") UUID id) {
        Environment env = Environment.findById(id);
        if (env == null) throw new NotFoundException();
        return env;
    }

    @POST
    @Transactional
    @RolesAllowed("thaddeus-admin")
    public Response create(@Valid Environment env, @Context UriInfo uriInfo) {
        env.persist();
        auditService.log(userId(), username(), "CREATE", "environment", env.id.toString(), null,
                "{\"name\":\"" + env.name + "\"}");
        return Response.created(uriInfo.getAbsolutePathBuilder().path(env.id.toString()).build())
                .entity(env).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    @RolesAllowed("thaddeus-admin")
    public Environment update(@PathParam("id") UUID id, @Valid Environment update) {
        Environment env = Environment.findById(id);
        if (env == null) throw new NotFoundException();
        env.name = update.name;
        env.description = update.description;
        env.color = update.color;
        auditService.log(userId(), username(), "UPDATE", "environment", id.toString(), null, null);
        return env;
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    @RolesAllowed("thaddeus-admin")
    public Response delete(@PathParam("id") UUID id) {
        Environment env = Environment.findById(id);
        if (env == null) throw new NotFoundException();
        long agentCount = Agent.count("JOIN agentEnvironments ae WHERE ae.id = ?1", id);
        if (agentCount > 0) {
            throw new WebApplicationException(
                    Response.status(409).entity("{\"error\":\"Environment has active deployment targets\"}").build());
        }
        auditService.log(userId(), username(), "DELETE", "environment", id.toString(), null,
                "{\"name\":\"" + env.name + "\"}");
        env.delete();
        return Response.noContent().build();
    }

    private String userId() {
        return identity.isAnonymous() ? "anonymous" : identity.getPrincipal().getName();
    }

    private String username() {
        return identity.isAnonymous() ? null : identity.getPrincipal().getName();
    }
}
