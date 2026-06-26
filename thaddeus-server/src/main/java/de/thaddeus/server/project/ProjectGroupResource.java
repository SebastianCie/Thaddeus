package de.thaddeus.server.project;

import jakarta.annotation.security.RolesAllowed;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;

import java.util.List;
import java.util.UUID;

@Path("/api/project-groups")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@ApplicationScoped
public class ProjectGroupResource {

    @GET
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public List<ProjectGroup> list() {
        return ProjectGroup.listAll(io.quarkus.panache.common.Sort.by("name"));
    }

    @POST
    @Transactional
    @RolesAllowed("thaddeus-admin")
    public Response create(@Valid ProjectGroup body, @Context UriInfo uriInfo) {
        body.id = null;
        body.persist();
        return Response.created(uriInfo.getAbsolutePathBuilder().path(body.id.toString()).build())
                .entity(body).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    @RolesAllowed("thaddeus-admin")
    public ProjectGroup update(@PathParam("id") UUID id, @Valid ProjectGroup body) {
        ProjectGroup group = ProjectGroup.findById(id);
        if (group == null) throw new NotFoundException();
        group.name = body.name;
        group.description = body.description;
        return group;
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    @RolesAllowed("thaddeus-admin")
    public Response delete(@PathParam("id") UUID id) {
        ProjectGroup group = ProjectGroup.findById(id);
        if (group == null) throw new NotFoundException();
        Project.update("groupId = null WHERE groupId = ?1", id);
        group.delete();
        return Response.noContent().build();
    }
}
