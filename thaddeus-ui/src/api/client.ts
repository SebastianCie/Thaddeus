import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Inject Keycloak token if available
api.interceptors.request.use((config) => {
  const token = (window as any).__kc_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Agents ────────────────────────────────────────────────────────────────────
export const agentsApi = {
  list: () => api.get('/agents').then(r => r.data),
  get: (id: string) => api.get(`/agents/${id}`).then(r => r.data),
  assignTargets: (id: string, data: object) => api.put(`/agents/${id}/targets`, data).then(r => r.data),
};

// ── Environments ──────────────────────────────────────────────────────────────
export const environmentsApi = {
  list: () => api.get('/environments').then(r => r.data),
  create: (data: object) => api.post('/environments', data).then(r => r.data),
  update: (id: string, data: object) => api.put(`/environments/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/environments/${id}`),
};

// ── Packages ──────────────────────────────────────────────────────────────────
export const packagesApi = {
  list: (search?: string, page = 0, size = 20) =>
    api.get('/packages', { params: { search, page, size } }).then(r => r.data),
  versions: (packageId: string) => api.get(`/packages/${packageId}/versions`).then(r => r.data),
  delete: (packageId: string, version: string) =>
    api.delete(`/packages/${packageId}/${version}`),
};

// ── Projects ──────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: () => api.get('/projects').then(r => r.data),
  get: (id: string) => api.get(`/projects/${id}`).then(r => r.data),
  create: (data: object) => api.post('/projects', data).then(r => r.data),
  update: (id: string, data: object) => api.put(`/projects/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  getSteps: (id: string) => api.get(`/projects/${id}/steps`).then(r => r.data),
  replaceSteps: (id: string, steps: object[]) => api.put(`/projects/${id}/steps`, steps).then(r => r.data),
  getVariables: (id: string) => api.get(`/projects/${id}/variables`).then(r => r.data),
  createVariable: (id: string, data: object) => api.post(`/projects/${id}/variables`, data).then(r => r.data),
  updateVariable: (id: string, varId: string, data: object) =>
    api.put(`/projects/${id}/variables/${varId}`, data).then(r => r.data),
  deleteVariable: (id: string, varId: string) => api.delete(`/projects/${id}/variables/${varId}`),
};

// ── Releases ──────────────────────────────────────────────────────────────────
export const releasesApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/releases`).then(r => r.data),
  get: (projectId: string, releaseId: string) =>
    api.get(`/projects/${projectId}/releases/${releaseId}`).then(r => r.data),
  create: (projectId: string, data: object) =>
    api.post(`/projects/${projectId}/releases`, data).then(r => r.data),
  getVariables: (projectId: string, releaseId: string) =>
    api.get(`/projects/${projectId}/releases/${releaseId}/variables`).then(r => r.data),
};

// ── Deployments ───────────────────────────────────────────────────────────────
export const deploymentsApi = {
  list: (limit = 50) => api.get('/deployments', { params: { limit } }).then(r => r.data),
  get: (id: string) => api.get(`/deployments/${id}`).then(r => r.data),
  trigger: (releaseId: string, environmentId: string) =>
    api.post(`/releases/${releaseId}/deployments`, { environmentId }).then(r => r.data),
  cancel: (id: string) => api.post(`/deployments/${id}/cancel`),
  tasks: (id: string) => api.get(`/deployments/${id}/tasks`).then(r => r.data),
};

// ── Task Logs ─────────────────────────────────────────────────────────────────
export const tasksApi = {
  getLogs: (taskId: string, since?: string) =>
    api.get(`/tasks/${taskId}/logs`, { params: { since } }).then(r => r.data),
};

// ── Audit ─────────────────────────────────────────────────────────────────────
export const auditApi = {
  list: (page = 0, size = 50, userId?: string, action?: string) =>
    api.get('/audit-log', { params: { page, size, userId, action } }).then(r => r.data),
};
