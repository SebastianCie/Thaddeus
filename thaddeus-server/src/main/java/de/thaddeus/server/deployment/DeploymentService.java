package de.thaddeus.server.deployment;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.thaddeus.server.agent.Agent;
import de.thaddeus.server.agent.AgentEvent;
import de.thaddeus.server.agent.SseStreamManager;
import de.thaddeus.server.common.EncryptionService;
import de.thaddeus.server.environment.Environment;
import de.thaddeus.server.project.DeploymentStep;
import de.thaddeus.server.release.Release;
import de.thaddeus.server.release.ReleaseVariable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.util.*;

@ApplicationScoped
public class DeploymentService {

    private static final Logger log = Logger.getLogger(DeploymentService.class);

    @Inject SseStreamManager streamManager;
    @Inject ObjectMapper objectMapper;
    @Inject EncryptionService encryption;

    @Transactional
    public Deployment triggerDeployment(UUID releaseId, UUID environmentId, String createdBy) throws Exception {
        Release release = Release.findById(releaseId);
        if (release == null) throw new jakarta.ws.rs.NotFoundException("Release not found");

        Environment environment = Environment.findById(environmentId);
        if (environment == null) throw new jakarta.ws.rs.NotFoundException("Environment not found");

        // Parse process snapshot to get steps
        List<Map<String, Object>> steps = objectMapper.readValue(
                release.processSnapshotJson, new TypeReference<>() {});

        if (steps.isEmpty()) {
            throw new WebApplicationException(
                    Response.status(400).entity("{\"error\":\"Release has no deployment steps\"}").build());
        }

        Deployment deployment = new Deployment();
        deployment.releaseId = releaseId;
        deployment.environmentId = environmentId;
        deployment.status = DeploymentStatus.RUNNING;
        deployment.createdBy = createdBy;
        deployment.persist();

        // Resolve variables for the environment
        Map<String, String> variables = resolveVariables(releaseId, environmentId);

        // Dispatch per step: each step specifies which target roles it requires.
        // Agents are selected by environment + role — different steps can target different machines.
        for (int i = 0; i < steps.size(); i++) {
            Map<String, Object> stepDef = steps.get(i);
            String stepType = (String) stepDef.get("type");

            List<String> stepRoles = stepDef.get("targetRoles") instanceof List<?> raw
                    ? raw.stream().map(Object::toString).toList()
                    : List.of();

            List<Agent> targetAgents = stepRoles.isEmpty()
                    ? Agent.findByEnvironment(environmentId)
                    : Agent.findByEnvironmentAndRoles(environmentId, stepRoles);

            if (targetAgents.isEmpty()) {
                log.warnf("Step %d (%s) has no matching ONLINE agents in environment %s (roles: %s) — skipping",
                        i, stepType, environment.name, stepRoles);
                continue;
            }

            for (Agent agent : targetAgents) {
                DeploymentTask task = new DeploymentTask();
                task.deploymentId = deployment.id;
                task.agentId = agent.id;
                task.stepPosition = i;
                task.stepType = stepType != null ? stepType : "UNKNOWN";
                task.status = DeploymentStatus.PENDING;
                task.persist();

                Map<String, Object> taskPayload = buildTaskPayload(task, stepDef, release, variables);

                boolean sent = streamManager.send(agent.id, AgentEvent.deployTask(task.id.toString(), taskPayload));
                if (sent) {
                    task.status = DeploymentStatus.RUNNING;
                    task.startedAt = Instant.now();
                    log.infof("Dispatched task %s (step %d) to agent %s", task.id, i, agent.hostname);
                } else {
                    task.status = DeploymentStatus.FAILED;
                    task.finishedAt = Instant.now();
                    log.warnf("Agent %s not connected, task %s marked FAILED", agent.hostname, task.id);
                }
            }
        }

        return deployment;
    }

    @Transactional
    public void cancelDeployment(UUID deploymentId) {
        Deployment deployment = Deployment.findById(deploymentId);
        if (deployment == null) throw new jakarta.ws.rs.NotFoundException();
        if (deployment.status != DeploymentStatus.PENDING && deployment.status != DeploymentStatus.RUNNING) {
            throw new WebApplicationException(
                    Response.status(409).entity("{\"error\":\"Deployment is not in a cancellable state\"}").build());
        }

        List<DeploymentTask> tasks = DeploymentTask.forDeployment(deploymentId);
        for (DeploymentTask task : tasks) {
            if (task.status == DeploymentStatus.PENDING || task.status == DeploymentStatus.RUNNING) {
                streamManager.send(task.agentId, AgentEvent.cancelTask(task.id.toString()));
                task.status = DeploymentStatus.CANCELLED;
                task.finishedAt = Instant.now();
            }
        }

        deployment.status = DeploymentStatus.CANCELLED;
        deployment.finishedAt = Instant.now();
    }

    private Map<String, String> resolveVariables(UUID releaseId, UUID environmentId) {
        List<ReleaseVariable> vars = ReleaseVariable.forRelease(releaseId);
        Map<String, String> resolved = new LinkedHashMap<>();
        for (ReleaseVariable v : vars) {
            if (v.environmentId == null || v.environmentId.equals(environmentId)) {
                String value = encryption.decrypt(v.valueEncrypted);
                resolved.merge(v.name, value, (existing, incoming) -> incoming);
            }
        }
        return resolved;
    }

    private Map<String, Object> buildTaskPayload(DeploymentTask task, Map<String, Object> stepDef,
                                                  Release release, Map<String, String> variables) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("taskId", task.id.toString());
        payload.put("deploymentId", task.deploymentId.toString());
        payload.put("stepPosition", task.stepPosition);
        payload.put("stepType", task.stepType);
        payload.put("stepConfig", stepDef.getOrDefault("configJson", "{}"));
        payload.put("packageId", release.packageId);
        payload.put("packageVersion", release.packageVersion);
        payload.put("variables", variables);
        payload.put("serverUrl", ""); // injected at runtime via config
        return payload;
    }
}
