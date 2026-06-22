package de.thaddeus.server.audit;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

/**
 * Writes audit log entries transactionally.
 * Called directly from service methods that mutate state.
 */
@ApplicationScoped
public class AuditService {

    @Transactional(Transactional.TxType.REQUIRES_NEW)
    public void log(String userId, String username, String action,
                    String resourceType, String resourceId,
                    String ipAddress, String detailsJson) {
        AuditLog entry = new AuditLog();
        entry.userId = userId != null ? userId : "system";
        entry.username = username;
        entry.action = action;
        entry.resourceType = resourceType;
        entry.resourceId = resourceId;
        entry.ipAddress = ipAddress;
        entry.detailsJson = detailsJson;
        entry.persist();
    }
}
