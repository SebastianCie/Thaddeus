export type AgentStatus = 'ONLINE' | 'OFFLINE';
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
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentStep {
  id: string;
  projectId: string;
  position: number;
  type: string;
  configJson: string;
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
