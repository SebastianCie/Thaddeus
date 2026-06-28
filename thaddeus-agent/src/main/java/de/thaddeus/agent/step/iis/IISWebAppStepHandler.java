package de.thaddeus.agent.step.iis;

import de.thaddeus.agent.log.TaskLogger;
import de.thaddeus.agent.step.StepContext;
import de.thaddeus.agent.step.StepHandler;
import de.thaddeus.agent.step.powershell.PowerShellRunner;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;

/**
 * Issue #16 — Deploy IIS Web Application step.
 */
@ApplicationScoped
public class IISWebAppStepHandler implements StepHandler {

    @Inject PowerShellRunner runner;
    @Inject TaskLogger taskLogger;
    @Inject PackageDownloader downloader;

    @Override
    public String type() {
        return "DEPLOY_IIS_WEBAPP";
    }

    @Override
    public void execute(StepContext ctx) throws Exception {
        Map<String, Object> cfg = ctx.stepConfig();
        String parentSiteName = required(cfg, "parentSiteName");
        String virtualPath = required(cfg, "virtualPath");
        String physicalPath = required(cfg, "physicalPath");
        String appPoolName = (String) cfg.getOrDefault("appPoolName", virtualPath.replace("/", "") + "Pool");

        String packageId = required(cfg, "packageId");
        String packageVersion = cfg.containsKey("packageVersion") ? (String) cfg.get("packageVersion") : ctx.packageVersion();
        taskLogger.info(ctx.taskId(), "Downloading package " + packageId + " " + packageVersion);
        Path nupkg = downloader.download(packageId, packageVersion, ctx.workDir());

        Path targetDir = Path.of(physicalPath);
        Files.createDirectories(targetDir);
        extractNupkg(nupkg, targetDir);

        taskLogger.info(ctx.taskId(), "Configuring IIS Web Application: " + parentSiteName + virtualPath);
        String script = loadScript("deploy-iis-webapp.ps1")
                .replace("{{PARENT_SITE}}", parentSiteName)
                .replace("{{VIRTUAL_PATH}}", virtualPath)
                .replace("{{PHYSICAL_PATH}}", targetDir.toString())
                .replace("{{APP_POOL_NAME}}", appPoolName);

        Path scriptPath = ctx.workDir().resolve("_deploy-iis-webapp.ps1");
        Files.writeString(scriptPath, script);

        runner.run(ctx.taskId(), scriptPath, ctx.variables(), Set.of(), ctx.workDir(), 10 * 60_000L);
    }

    private void extractNupkg(Path nupkg, Path targetDir) throws Exception {
        try (var zip = new java.util.zip.ZipFile(nupkg.toFile())) {
            var entries = zip.entries();
            while (entries.hasMoreElements()) {
                var entry = entries.nextElement();
                if (entry.getName().endsWith(".nuspec") || entry.getName().startsWith("[Content_Types]")) continue;
                Path dest = targetDir.resolve(entry.getName()).normalize();
                if (!dest.startsWith(targetDir)) throw new SecurityException("Zip slip: " + entry.getName());
                if (entry.isDirectory()) Files.createDirectories(dest);
                else {
                    Files.createDirectories(dest.getParent());
                    try (var in = zip.getInputStream(entry)) {
                        Files.copy(in, dest, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    }
                }
            }
        }
    }

    private String loadScript(String name) throws IOException {
        try (InputStream is = getClass().getResourceAsStream("/scripts/" + name)) {
            if (is == null) throw new IOException("Script not found: " + name);
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private String required(Map<String, Object> cfg, String key) {
        Object val = cfg.get(key);
        if (val == null || val.toString().isBlank()) throw new IllegalArgumentException("Missing required config: " + key);
        return val.toString();
    }
}
