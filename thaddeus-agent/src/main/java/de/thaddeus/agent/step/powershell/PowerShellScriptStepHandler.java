package de.thaddeus.agent.step.powershell;

import de.thaddeus.agent.log.TaskLogger;
import de.thaddeus.agent.step.StepContext;
import de.thaddeus.agent.step.StepHandler;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Issue #17 — Run PowerShell Script step.
 * Accepts inline script (config.script) or a file path within the package (config.scriptFile).
 */
@ApplicationScoped
public class PowerShellScriptStepHandler implements StepHandler {

    @Inject PowerShellRunner runner;
    @Inject TaskLogger taskLogger;

    @Override
    public String type() {
        return "RUN_POWERSHELL_SCRIPT";
    }

    @Override
    public void execute(StepContext ctx) throws Exception {
        Map<String, Object> cfg = ctx.stepConfig();
        String inlineScript = (String) cfg.get("script");
        String scriptFile = (String) cfg.get("scriptFile");
        int timeoutMinutes = cfg.containsKey("timeoutMinutes")
                ? ((Number) cfg.get("timeoutMinutes")).intValue() : 10;

        Path scriptPath;
        if (inlineScript != null && !inlineScript.isBlank()) {
            scriptPath = ctx.workDir().resolve("_inline.ps1");
            Files.writeString(scriptPath, inlineScript);
            taskLogger.info(ctx.taskId(), "Using inline PowerShell script");
        } else if (scriptFile != null && !scriptFile.isBlank()) {
            scriptPath = ctx.workDir().resolve(scriptFile);
            if (!Files.exists(scriptPath)) {
                throw new IllegalArgumentException("Script file not found in package: " + scriptFile);
            }
            taskLogger.info(ctx.taskId(), "Using script file: " + scriptFile);
        } else {
            throw new IllegalArgumentException("No script or scriptFile configured");
        }

        // Identify secrets for masking
        Set<String> secretNames = ctx.variables().keySet(); // caller should pass secret set separately in a real impl

        runner.run(ctx.taskId(), scriptPath, ctx.variables(), secretNames,
                ctx.workDir(), (long) timeoutMinutes * 60_000);
    }
}
