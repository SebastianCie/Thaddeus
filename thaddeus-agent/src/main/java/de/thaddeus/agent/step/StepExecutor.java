package de.thaddeus.agent.step;

import de.thaddeus.agent.log.TaskLogger;
import de.thaddeus.agent.log.TaskStatusUpdate;
import de.thaddeus.agent.registration.ServerClient;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Dispatches task execution to the appropriate StepHandler, reports status back.
 */
@ApplicationScoped
public class StepExecutor {

    private static final Logger log = Logger.getLogger(StepExecutor.class);

    @Inject Instance<StepHandler> handlers;
    @Inject TaskLogger taskLogger;

    @RestClient
    ServerClient serverClient;

    private Map<String, StepHandler> handlerMap;

    @jakarta.annotation.PostConstruct
    void init() {
        handlerMap = handlers.stream()
                .collect(Collectors.toMap(StepHandler::type, Function.identity()));
        log.infof("Registered step handlers: %s", handlerMap.keySet());
    }

    public void execute(StepContext ctx) {
        String taskId = ctx.taskId();
        try {
            serverClient.updateStatus(taskId, new TaskStatusUpdate("RUNNING"));
            taskLogger.info(taskId, "Starting step [" + ctx.stepType() + "] at position " + ctx.stepPosition());

            StepHandler handler = handlerMap.get(ctx.stepType());
            if (handler == null) {
                throw new IllegalArgumentException("Unknown step type: " + ctx.stepType());
            }

            handler.execute(ctx);

            taskLogger.flush(taskId);
            serverClient.updateStatus(taskId, new TaskStatusUpdate("SUCCESS"));
            taskLogger.info(taskId, "Step completed successfully");

        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            taskLogger.warn(taskId, "Step was cancelled");
            taskLogger.flush(taskId);
            serverClient.updateStatus(taskId, new TaskStatusUpdate("CANCELLED"));

        } catch (Exception e) {
            taskLogger.error(taskId, "Step failed: " + e.getMessage());
            log.errorf(e, "Step %s failed for task %s", ctx.stepType(), taskId);
            taskLogger.flush(taskId);
            serverClient.updateStatus(taskId, new TaskStatusUpdate("FAILED"));
        } finally {
            taskLogger.close(taskId);
        }
    }
}
