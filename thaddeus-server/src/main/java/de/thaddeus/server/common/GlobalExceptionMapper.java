package de.thaddeus.server.common;

import jakarta.persistence.PersistenceException;
import jakarta.validation.ConstraintViolationException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

import java.util.Map;

@Provider
public class GlobalExceptionMapper implements ExceptionMapper<Exception> {

    private static final Logger log = Logger.getLogger(GlobalExceptionMapper.class);

    @Override
    public Response toResponse(Exception e) {
        if (e instanceof WebApplicationException wae) {
            return wae.getResponse();
        }
        if (e instanceof ConstraintViolationException cve) {
            String message = cve.getConstraintViolations().stream()
                    .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                    .reduce((a, b) -> a + "; " + b).orElse("Validation failed");
            return Response.status(400)
                    .type(MediaType.APPLICATION_JSON)
                    .entity(Map.of("error", message))
                    .build();
        }
        if (e instanceof PersistenceException pe) {
            String msg = pe.getCause() != null ? pe.getCause().getMessage() : pe.getMessage();
            if (msg != null && msg.contains("unique")) {
                return Response.status(409)
                        .type(MediaType.APPLICATION_JSON)
                        .entity(Map.of("error", "A resource with that identifier already exists"))
                        .build();
            }
        }
        log.error("Unhandled exception", e);
        return Response.status(500)
                .type(MediaType.APPLICATION_JSON)
                .entity(Map.of("error", "Internal server error"))
                .build();
    }
}
