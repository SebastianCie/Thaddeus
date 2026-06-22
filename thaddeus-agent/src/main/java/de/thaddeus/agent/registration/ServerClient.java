package de.thaddeus.agent.registration;

import de.thaddeus.agent.log.LogBatch;
import de.thaddeus.agent.log.TaskStatusUpdate;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

import java.util.Map;

@RegisterRestClient(configKey = "thaddeus-server")
@Path("/api")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface ServerClient {

    @POST
    @Path("/agents/register")
    Map<String, Object> register(RegisterRequest body);

    @POST
    @Path("/tasks/{taskId}/logs")
    void sendLogs(@PathParam("taskId") String taskId, LogBatch batch);

    @PUT
    @Path("/tasks/{taskId}/status")
    void updateStatus(@PathParam("taskId") String taskId, TaskStatusUpdate status);

    @GET
    @Path("/packages/{packageId}/{version}/download")
    @Produces(MediaType.APPLICATION_OCTET_STREAM)
    byte[] downloadPackage(@PathParam("packageId") String packageId,
                           @PathParam("version") String version);
}
