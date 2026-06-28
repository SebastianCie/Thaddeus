export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'DISABLED';
export type DeploymentStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface Agent {
  id: string;
  hostname: string;
  ip: string;
  osVersion: string;
  agentVersion: string;
  status: AgentStatus;
  registeredAt: string;
  lastSeenAt: string;
  agentEnvironments: Environment[];
  agentRoles: AgentRole[];
}

export interface AgentRole {
  id: string;
  name: string;
}

export interface Environment {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
}

export interface Package {
  id: string;
  packageId: string;
  version: string;
  filename: string;
  sizeBytes: number;
  sha256: string;
  uploadedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  packageId: string;
  groupId: string | null;
  lifecycleId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentLifecycle {
  id: string;
  name: string;
  description: string;
  phases: LifecyclePhase[];
  createdAt: string;
  updatedAt: string;
}

export interface LifecyclePhase {
  id: string;
  name: string;
  position: number;
  optional: boolean;
  autoDeploy: boolean;
  environments: Environment[];
}

export interface LifecycleListItem {
  id: string;
  name: string;
  description: string;
  phaseCount: number;
  projectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectGroup {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardEnvironmentStatus {
  environmentId: string;
  environmentName: string;
  environmentColor: string;
  status: DeploymentStatus | null;
  releaseVersion: string | null;
  deployedAt: string | null;
}

export interface DashboardProject {
  projectId: string;
  projectName: string;
  environments: DashboardEnvironmentStatus[];
}

export interface DashboardGroup {
  groupId: string | null;
  groupName: string;
  projects: DashboardProject[];
}

export interface ProjectDashboardEnvironmentStatus {
  environmentId: string;
  environmentName: string;
  environmentColor: string;
  status: DeploymentStatus | null;
  deployedAt: string | null;
}

export interface ProjectDashboardRelease {
  releaseId: string;
  version: string;
  createdAt: string;
  environments: ProjectDashboardEnvironmentStatus[];
}

export interface ProjectDashboardView {
  projectId: string;
  projectName: string;
  releases: ProjectDashboardRelease[];
}

export interface DeploymentStep {
  id: string;
  projectId: string;
  position: number;
  type: string;
  configJson: string;
  targetRoles: string[];
}

export interface Variable {
  id: string;
  name: string;
  value: string;
  isSecret: boolean;
  environmentId: string | null;
}

export interface Release {
  id: string;
  projectId: string;
  version: string;
  packageId: string;
  packageVersion: string;
  createdAt: string;
}

export interface Deployment {
  id: string;
  releaseId: string;
  environmentId: string;
  status: DeploymentStatus;
  createdBy: string;
  createdAt: string;
  finishedAt: string | null;
}

export interface DeploymentTask {
  id: string;
  deploymentId: string;
  agentId: string;
  stepPosition: number;
  stepType: string;
  status: DeploymentStatus;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface TaskLog {
  id: string;
  taskId: string;
  loggedAt: string;
  level: string;
  message: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
}
