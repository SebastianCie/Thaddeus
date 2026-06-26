package de.thaddeus.server.project;

import java.util.ArrayList;
import java.util.List;

public class ProjectDashboardView {

    public String projectId;
    public String projectName;
    public List<ReleaseEntry> releases = new ArrayList<>();

    public static class ReleaseEntry {
        public String releaseId;
        public String version;
        public String createdAt;
        public List<EnvironmentEntry> environments = new ArrayList<>();
    }

    public static class EnvironmentEntry {
        public String environmentId;
        public String environmentName;
        public String environmentColor;
        public String status;      // null = never deployed
        public String deployedAt;  // ISO-8601, null = never deployed
    }
}
