package de.thaddeus.agent.step.powershell;

import de.thaddeus.agent.log.TaskLogger;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Executes PowerShell scripts via ProcessBuilder.
 * Secret variables are injected as environment variables, never on the command line.
 */
@ApplicationScoped
public class PowerShellRunner {

    private static final Logger log = Logger.getLogger(PowerShellRunner.class);

    @Inject TaskLogger taskLogger;

    /**
     * @param taskId      for log routing
     * @param scriptPath  path to the .ps1 file
     * @param envVars     variables injected as env (secrets included, masked in logs)
     * @param secretNames set of variable names that are secrets (for log masking)
     * @param workDir     working directory for the process
     * @param timeoutMs   milliseconds before the process is killed
     */
    public void run(String taskId, Path scriptPath, Map<String, String> envVars,
                    java.util.Set<String> secretNames, Path workDir, long timeoutMs) throws Exception {

        boolean isWindows = System.getProperty("os.name", "").toLowerCase().contains("win");
        String psExe = isWindows ? "powershell.exe" : "pwsh";

        List<String> command = List.of(
                psExe,
                "-NonInteractive",
                "-ExecutionPolicy", "Bypass",
                "-File", scriptPath.toAbsolutePath().toString()
        );

        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(workDir.toFile());
        pb.redirectErrorStream(true);

        Map<String, String> env = pb.environment();
        envVars.forEach((k, v) -> {
            env.put(k, v);
            if (!secretNames.contains(k)) {
                taskLogger.info(taskId, "ENV: " + k + "=" + v);
            } else {
                taskLogger.info(taskId, "ENV: " + k + "=***");
            }
        });

        taskLogger.info(taskId, "Executing: " + String.join(" ", command));

        Process process = pb.start();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                // Mask secrets in output
                String masked = maskSecrets(line, envVars, secretNames);
                taskLogger.info(taskId, masked);
            }
        }

        boolean finished = process.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new RuntimeException("PowerShell script timed out after " + timeoutMs + "ms");
        }

        int exitCode = process.exitValue();
        taskLogger.info(taskId, "Exit code: " + exitCode);
        if (exitCode != 0) {
            throw new RuntimeException("PowerShell script exited with code " + exitCode);
        }
    }

    private String maskSecrets(String line, Map<String, String> vars, java.util.Set<String> secrets) {
        String result = line;
        for (String secret : secrets) {
            String value = vars.get(secret);
            if (value != null && !value.isEmpty()) {
                result = result.replace(value, "***");
            }
        }
        return result;
    }
}
