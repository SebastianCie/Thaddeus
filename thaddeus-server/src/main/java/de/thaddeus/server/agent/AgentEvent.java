package de.thaddeus.server.agent;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

/**
 * SSE event payload sent from server to agent.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AgentEvent(
        String type,
        String taskId,
        Map<String, Object> payload
) {
    public static AgentEvent ping() {
        return new AgentEvent("PING", null, null);
    }

    public static AgentEvent deployTask(String taskId, Map<String, Object> taskPayload) {
        return new AgentEvent("DEPLOY_TASK", taskId, taskPayload);
    }

    public static AgentEvent cancelTask(String taskId) {
        return new AgentEvent("CANCEL_TASK", taskId, null);
    }
}
