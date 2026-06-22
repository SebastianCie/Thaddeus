package de.thaddeus.agent.step;

import java.nio.file.Path;
import java.util.Map;

/**
 * All data a step handler needs to execute its work.
 */
public record StepContext(
        String taskId,
        String deploymentId,
        int stepPosition,
        String stepType,
        Map<String, Object> stepConfig,
        String packageId,
        String packageVersion,
        Map<String, String> variables,
        Path workDir
) {}
