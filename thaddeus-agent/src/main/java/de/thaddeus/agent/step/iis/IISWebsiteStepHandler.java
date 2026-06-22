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
 * Issue #15 — Deploy IIS Website step.
 * Downloads the nupkg, extracts it, configures IIS via PowerShell.
 */
@ApplicationScoped
public class IISWebsiteStepHandler implements StepHandler {

    @Inject PowerShellRunner runner;
    @Inject TaskLogger taskLogger;
    @Inject PackageDownloader downloader;

    @Override
    public String type() {
        return "DEPLOY_IIS_WEBSITE";
    }

    @Override
    public void execute(StepContext ctx) throws Exception {
        Map<String, Object> cfg = ctx.stepConfig();
        String siteName = required(cfg, "siteName");
        String appPoolName = (String) cfg.getOrDefault("appPoolName", siteName + "Pool");
        String physicalPath = required(cfg, "physicalPath");
        String appPoolDotNetVersion = (String) cfg.getOrDefault("appPoolDotNetVersion", "v4.0");

        taskLogger.info(ctx.taskId(), "Downloading package " + ctx.packageId() + " " + ctx.packageVersion());
        Path nupkg = downloader.download(ctx.packageId(), ctx.packageVersion(), ctx.workDir());

        taskLogger.info(ctx.taskId(), "Extracting package to " + physicalPath);
        Path extractDir = extractNupkg(nupkg, Path.of(physicalPath), ctx);

        taskLogger.info(ctx.taskId(), "Configuring IIS website: " + siteName);
        String script = loadScript("deploy-iis-website.ps1")
                .replace("{{SITE_NAME}}", siteName)
                .replace("{{APP_POOL_NAME}}", appPoolName)
                .replace("{{PHYSICAL_PATH}}", extractDir.toString())
                .replace("{{DOTNET_VERSION}}", appPoolDotNetVersion);

        Path scriptPath = ctx.workDir().resolve("_deploy-iis-website.ps1");
        Files.writeString(scriptPath, script);

        runner.run(ctx.taskId(), scriptPath, ctx.variables(), Set.of(), ctx.workDir(), 10 * 60_000L);
    }

    private Path extractNupkg(Path nupkg, Path targetDir, StepContext ctx) throws Exception {
        Files.createDirectories(targetDir);
        // nupkg is a ZIP — extract with PowerShell or Java ZipFile
        taskLogger.info(ctx.taskId(), "Extracting to " + targetDir);
        try (var zip = new java.util.zip.ZipFile(nupkg.toFile())) {
            var entries = zip.entries();
            while (entries.hasMoreElements()) {
                var entry = entries.nextElement();
                // Skip nuspec and [Content_Types].xml
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
        return targetDir;
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
