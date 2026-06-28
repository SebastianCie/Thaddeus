package de.thaddeus.server.project;

import de.thaddeus.server.environment.Environment;
import de.thaddeus.server.lifecycle.DeploymentLifecycle;
import de.thaddeus.server.lifecycle.LifecyclePhase;
import de.thaddeus.server.release.Release;
import jakarta.annotation.security.RolesAllowed;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Path("/api/dashboard")
@Produces(MediaType.APPLICATION_JSON)
@ApplicationScoped
public class DashboardResource {

    @Inject
    EntityManager em;

    record DeploymentInfo(String status, String version, Instant deployedAt) {}

    @GET
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public List<DashboardView> get() {
        List<Environment> environments = Environment.listAll(io.quarkus.panache.common.Sort.by("name"));
        List<Project> projects = Project.listAll(io.quarkus.panache.common.Sort.by("name"));
        List<ProjectGroup> groups = ProjectGroup.listAll(io.quarkus.panache.common.Sort.by("name"));

        // Latest deployment info per (project_id, environment_id)
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT DISTINCT ON (r.project_id, d.environment_id)
                    r.project_id, d.environment_id, d.status, r.version,
                    COALESCE(d.finished_at, d.created_at) AS deployed_at
                FROM deployment d
                JOIN release r ON r.id = d.release_id
                ORDER BY r.project_id, d.environment_id, d.created_at DESC
                """).getResultList();

        Map<UUID, Map<UUID, DeploymentInfo>> infoMap = new HashMap<>();
        for (Object[] row : rows) {
            UUID projectId = (UUID) row[0];
            UUID environmentId = (UUID) row[1];
            String status = (String) row[2];
            String version = (String) row[3];
            Instant deployedAt = row[4] instanceof Timestamp ts ? ts.toInstant()
                    : row[4] instanceof Instant i ? i
                    : null;
            infoMap.computeIfAbsent(projectId, k -> new HashMap<>())
                   .put(environmentId, new DeploymentInfo(status, version, deployedAt));
        }

        final UUID UNGROUPED = new UUID(0, 0);
        Map<UUID, List<Project>> byGroup = projects.stream()
                .collect(Collectors.groupingBy(p -> p.groupId != null ? p.groupId : UNGROUPED));

        List<DashboardView> result = new ArrayList<>();

        for (ProjectGroup group : groups) {
            List<Project> members = byGroup.getOrDefault(group.id, List.of());
            result.add(buildView(group.id.toString(), group.name, members, environments, infoMap));
        }

        List<Project> ungrouped = byGroup.getOrDefault(UNGROUPED, List.of());
        if (!ungrouped.isEmpty()) {
            result.add(buildView(null, "Ungrouped", ungrouped, environments, infoMap));
        }

        return result;
    }

    @GET
    @Path("/project/{id}")
    @RolesAllowed({"thaddeus-admin", "thaddeus-deployer", "thaddeus-viewer"})
    public ProjectDashboardView getProject(@PathParam("id") UUID projectId) {
        Project project = Project.findById(projectId);
        if (project == null) throw new NotFoundException();

        List<Environment> environments = resolveEnvironments(project);
        List<Release> releases = Release.forProject(projectId);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT DISTINCT ON (d.release_id, d.environment_id)
                    d.release_id, d.environment_id, d.status,
                    COALESCE(d.finished_at, d.created_at) AS deployed_at, d.id
                FROM deployment d
                WHERE d.release_id IN (SELECT id FROM release WHERE project_id = :projectId)
                ORDER BY d.release_id, d.environment_id, d.created_at DESC
                """)
                .setParameter("projectId", projectId)
                .getResultList();

        // releaseId -> environmentId -> (status, deployedAt, deploymentId)
        record ReleaseEnvInfo(String status, Instant deployedAt, UUID deploymentId) {}
        Map<UUID, Map<UUID, ReleaseEnvInfo>> infoMap = new HashMap<>();
        for (Object[] row : rows) {
            UUID releaseId = (UUID) row[0];
            UUID environmentId = (UUID) row[1];
            String status = (String) row[2];
            Instant deployedAt = row[3] instanceof Timestamp ts ? ts.toInstant()
                    : row[3] instanceof Instant i ? i
                    : null;
            UUID deploymentId = (UUID) row[4];
            infoMap.computeIfAbsent(releaseId, k -> new HashMap<>())
                   .put(environmentId, new ReleaseEnvInfo(status, deployedAt, deploymentId));
        }

        ProjectDashboardView view = new ProjectDashboardView();
        view.projectId = project.id.toString();
        view.projectName = project.name;

        for (Release release : releases) {
            ProjectDashboardView.ReleaseEntry entry = new ProjectDashboardView.ReleaseEntry();
            entry.releaseId = release.id.toString();
            entry.version = release.version;
            entry.createdAt = release.createdAt.toString();
            Map<UUID, ReleaseEnvInfo> envInfo = infoMap.getOrDefault(release.id, Map.of());
            for (Environment env : environments) {
                ProjectDashboardView.EnvironmentEntry envEntry = new ProjectDashboardView.EnvironmentEntry();
                envEntry.environmentId = env.id.toString();
                envEntry.environmentName = env.name;
                envEntry.environmentColor = env.color;
                ReleaseEnvInfo info = envInfo.get(env.id);
                if (info != null) {
                    envEntry.status = info.status();
                    envEntry.deployedAt = info.deployedAt() != null ? info.deployedAt().toString() : null;
                    envEntry.deploymentId = info.deploymentId() != null ? info.deploymentId().toString() : null;
                }
                entry.environments.add(envEntry);
            }
            view.releases.add(entry);
        }

        return view;
    }

    private List<Environment> resolveEnvironments(Project project) {
        if (project.lifecycleId == null) {
            return Environment.listAll(io.quarkus.panache.common.Sort.by("name"));
        }
        DeploymentLifecycle lifecycle = DeploymentLifecycle.findById(project.lifecycleId);
        if (lifecycle == null) {
            return Environment.listAll(io.quarkus.panache.common.Sort.by("name"));
        }
        List<LifecyclePhase> phases = LifecyclePhase.find("lifecycle.id = ?1 ORDER BY position ASC", lifecycle.id).list();
        List<Environment> result = new ArrayList<>();
        Set<UUID> seen = new LinkedHashSet<>();
        for (LifecyclePhase phase : phases) {
            for (Environment env : phase.environments) {
                if (seen.add(env.id)) {
                    result.add(env);
                }
            }
        }
        return result;
    }

    private DashboardView buildView(String groupId, String groupName, List<Project> projects,
                                    List<Environment> environments,
                                    Map<UUID, Map<UUID, DeploymentInfo>> infoMap) {
        DashboardView view = new DashboardView();
        view.groupId = groupId;
        view.groupName = groupName;
        for (Project p : projects) {
            DashboardView.ProjectEntry entry = new DashboardView.ProjectEntry();
            entry.projectId = p.id.toString();
            entry.projectName = p.name;
            entry.description = p.description;
            Map<UUID, DeploymentInfo> envInfo = infoMap.getOrDefault(p.id, Map.of());
            for (Environment env : environments) {
                DashboardView.EnvironmentEntry envEntry = new DashboardView.EnvironmentEntry();
                envEntry.environmentId = env.id.toString();
                envEntry.environmentName = env.name;
                envEntry.environmentColor = env.color;
                DeploymentInfo info = envInfo.get(env.id);
                if (info != null) {
                    envEntry.status = info.status();
                    envEntry.releaseVersion = info.version();
                    envEntry.deployedAt = info.deployedAt() != null ? info.deployedAt().toString() : null;
                }
                entry.environments.add(envEntry);
            }
            view.projects.add(entry);
        }
        return view;
    }
}
