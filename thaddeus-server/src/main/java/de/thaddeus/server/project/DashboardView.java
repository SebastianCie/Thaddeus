package de.thaddeus.server.project;

import java.util.ArrayList;
import java.util.List;

public class DashboardView {

    public String groupId;
    public String groupName;
    public List<ProjectEntry> projects = new ArrayList<>();

    public static class ProjectEntry {
        public String projectId;
        public String projectName;
        public List<EnvironmentEntry> environments = new ArrayList<>();
    }

    public static class EnvironmentEntry {
        public String environmentId;
        public String environmentName;
        public String environmentColor;
        public String status;          // null = never deployed
        public String releaseVersion;  // null = never deployed
        public String deployedAt;      // ISO-8601, null = never deployed
    }
}
