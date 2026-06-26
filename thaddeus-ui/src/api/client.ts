import axios from 'axios';
import keycloak from '../auth/keycloak';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Proactively refresh the token before every request (handles expiry + background tabs)
api.interceptors.request.use(async (config) => {
  try {
    const refreshed = await keycloak.updateToken(30);
    if (refreshed) {
      (window as any).__kc_token = keycloak.token;
    }
  } catch {
    // Token refresh failed — redirect to login
    keycloak.logout();
    return Promise.reject(new Error('Session expired'));
  }
  const token = keycloak.token ?? (window as any).__kc_token;
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
  delete: (id: string) => api.delete(`/agents/${id}`),
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
  upload: (packageId: string, version: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.put(`/packages/${packageId}/${version}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  download: async (packageId: string, version: string, filename: string) => {
    const response = await api.get(`/packages/${packageId}/${version}/download`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },
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

// ── Project Groups ────────────────────────────────────────────────────────────
export const projectGroupsApi = {
  list: () => api.get('/project-groups').then(r => r.data),
  create: (data: object) => api.post('/project-groups', data).then(r => r.data),
  update: (id: string, data: object) => api.put(`/project-groups/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/project-groups/${id}`),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  get: () => api.get('/dashboard').then(r => r.data),
  getProject: (id: string) => api.get(`/dashboard/project/${id}`).then(r => r.data),
};

// ── Audit ─────────────────────────────────────────────────────────────────────
export const auditApi = {
  list: (page = 0, size = 50, userId?: string, action?: string) =>
    api.get('/audit-log', { params: { page, size, userId, action } }).then(r => r.data),
};
