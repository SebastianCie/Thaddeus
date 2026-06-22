package de.thaddeus.agent.step.iis;

import de.thaddeus.agent.registration.ServerClient;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.rest.client.inject.RestClient;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@ApplicationScoped
public class PackageDownloader {

    @RestClient
    ServerClient serverClient;

    public Path download(String packageId, String version, Path workDir) throws IOException {
        byte[] data = serverClient.downloadPackage(packageId, version);
        Path dest = workDir.resolve(packageId + "-" + version + ".nupkg");
        Files.createDirectories(workDir);
        Files.write(dest, data);
        return dest;
    }
}
