package de.thaddeus.server.audit;

import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import jakarta.annotation.security.RolesAllowed;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

import java.util.List;

@Path("/api/audit-log")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed("thaddeus-admin")
public class AuditResource {

    @GET
    public List<AuditLog> list(
            @QueryParam("page") @DefaultValue("0") int page,
            @QueryParam("size") @DefaultValue("50") int size,
            @QueryParam("userId") String userId,
            @QueryParam("action") String action) {

        String query = "1=1";
        var params = new java.util.HashMap<String, Object>();

        if (userId != null && !userId.isBlank()) {
            query += " AND userId = :userId";
            params.put("userId", userId);
        }
        if (action != null && !action.isBlank()) {
            query += " AND action = :action";
            params.put("action", action);
        }

        return AuditLog.find(query, Sort.by("timestamp").descending(), params)
                .page(Page.of(page, size))
                .list();
    }
}
