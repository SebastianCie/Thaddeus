package de.thaddeus.agent.step.pkg;

import de.thaddeus.agent.log.TaskLogger;
import de.thaddeus.agent.step.StepContext;
import de.thaddeus.agent.step.StepHandler;
import de.thaddeus.agent.step.iis.PackageDownloader;
import de.thaddeus.agent.step.powershell.PowerShellRunner;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@ApplicationScoped
public class RunPackageScriptStepHandler implements StepHandler {

    @Inject PowerShellRunner runner;
    @Inject TaskLogger taskLogger;
    @Inject PackageDownloader downloader;

    @Override
    public String type() {
        return "RUN_PACKAGE_SCRIPT";
    }

    @Override
    public void execute(StepContext ctx) throws Exception {
        Map<String, Object> cfg = ctx.stepConfig();
        String scriptFile = (String) cfg.getOrDefault("scriptFile", "scripts/deploy.ps1");
        int timeoutMinutes = cfg.containsKey("timeoutMinutes")
                ? ((Number) cfg.get("timeoutMinutes")).intValue() : 10;

        String packageId = cfg.containsKey("packageId") && cfg.get("packageId") != null && !cfg.get("packageId").toString().isBlank()
                ? cfg.get("packageId").toString() : ctx.packageId();
        if (packageId == null || packageId.isBlank()) throw new IllegalArgumentException("packageId not configured in step or release");
        String packageVersion = cfg.containsKey("packageVersion") && cfg.get("packageVersion") != null && !cfg.get("packageVersion").toString().isBlank()
                ? cfg.get("packageVersion").toString() : ctx.packageVersion();
        taskLogger.info(ctx.taskId(), "Downloading package " + packageId + " " + packageVersion);
        Path nupkg = downloader.download(packageId, packageVersion, ctx.workDir());

        taskLogger.info(ctx.taskId(), "Extracting package to workDir");
        extractNupkg(nupkg, ctx.workDir());

        Path scriptPath = ctx.workDir().resolve(scriptFile);
        if (!Files.exists(scriptPath)) {
            throw new IllegalArgumentException("Script file not found in package: " + scriptFile);
        }

        Map<String, String> vars = new HashMap<>(ctx.variables() != null ? ctx.variables() : Map.of());
        vars.put("PACKAGE_ID", packageId != null ? packageId : "");
        vars.put("PACKAGE_VERSION", packageVersion != null ? packageVersion : "");
        vars.put("DEPLOYMENT_ID", ctx.deploymentId() != null ? ctx.deploymentId() : "");

        taskLogger.info(ctx.taskId(), "Running script: " + scriptFile);
        runner.run(ctx.taskId(), scriptPath, vars, Set.of(), ctx.workDir(), (long) timeoutMinutes * 60_000);
    }

    private void extractNupkg(Path nupkg, Path targetDir) throws Exception {
        try (var zip = new java.util.zip.ZipFile(nupkg.toFile())) {
            var entries = zip.entries();
            while (entries.hasMoreElements()) {
                var entry = entries.nextElement();
                if (entry.getName().endsWith(".nuspec") || entry.getName().startsWith("[Content_Types]")) continue;
                Path dest = targetDir.resolve(entry.getName()).normalize();
                if (!dest.startsWith(targetDir)) throw new SecurityException("Zip slip detected: " + entry.getName());
                if (entry.isDirectory()) {
                    Files.createDirectories(dest);
                } else {
                    Files.createDirectories(dest.getParent());
                    try (var in = zip.getInputStream(entry)) {
                        Files.copy(in, dest, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    }
                }
            }
        }
    }
}
