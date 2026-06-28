import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { dashboardApi, projectsApi, projectGroupsApi } from '../api/client'
import type { DashboardEnvironmentStatus, DashboardGroup, DeploymentStatus } from '../types'

// ── Status cell ──────────────────────────────────────────────────────────────

function StatusCell({ env }: { env: DashboardEnvironmentStatus }) {
  if (!env.status || !env.releaseVersion) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)' }}>
        <span style={{ fontSize: 18, opacity: 0.5 }}>⊘</span>
        <span style={{ fontSize: 13 }}>No Data</span>
      </div>
    )
  }

  const isSuccess = env.status === 'SUCCESS'
  const isRunning = env.status === 'RUNNING' || env.status === 'PENDING'
  const bgColor = isSuccess
    ? 'var(--color-success)'
    : isRunning
    ? 'var(--color-primary)'
    : 'var(--color-error)'

  const icon = isSuccess ? '✓' : isRunning ? '⟳' : '✕'

  const dateStr = env.deployedAt
    ? format(new Date(env.deployedAt), 'MMM d, yyyy h:mm aa')
    : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 6, background: bgColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 15, fontWeight: 700, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{env.releaseVersion}</div>
        {dateStr && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.3 }}>{dateStr}</div>
        )}
      </div>
    </div>
  )
}

// ── Project avatar ────────────────────────────────────────────────────────────

function ProjectAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const hue = name.split('').reduce((n, c) => n + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 6, background: `hsl(${hue},40%,45%)`,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

// ── Group card ────────────────────────────────────────────────────────────────

function GroupCard({ group }: { group: DashboardGroup }) {
  const environments = group.projects[0]?.environments ?? []

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{group.groupName}</span>
        <span style={{
          background: 'var(--color-surface-2, #2a2a2a)', border: '1px solid var(--color-border)',
          borderRadius: 12, padding: '1px 8px', fontSize: 12, color: 'var(--color-text-muted)',
        }}>
          {group.projects.length}
        </span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ width: 220, paddingLeft: 20 }}></th>
                {environments.map(env => (
                  <th key={env.environmentId} style={{
                    textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                    color: 'var(--color-text-muted)', textTransform: 'uppercase',
                    paddingTop: 14, paddingBottom: 14, minWidth: 180,
                  }}>
                    {env.environmentName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.projects.length === 0 ? (
                <tr>
                  <td colSpan={environments.length + 1}>
                    <div className="empty-state" style={{ padding: '16px 20px' }}>No projects.</div>
                  </td>
                </tr>
              ) : group.projects.map((project, i) => (
                <tr key={project.projectId} style={{ borderTop: i === 0 ? undefined : '1px solid var(--color-border)' }}>
                  <td style={{ paddingLeft: 20, paddingRight: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ProjectAvatar name={project.projectName} />
                      <Link
                        to={`/projects/${project.projectId}/dashboard`}
                        style={{ color: 'var(--color-text)', textDecoration: 'none', fontWeight: 500, fontSize: 14 }}
                        onMouseOver={e => (e.currentTarget.style.color = 'var(--color-primary)')}
                        onMouseOut={e => (e.currentTarget.style.color = 'var(--color-text)')}
                      >
                        {project.projectName}
                      </Link>
                    </div>
                  </td>
                  {project.environments.map(env => (
                    <td key={env.environmentId} style={{ paddingRight: 24 }}>
                      <StatusCell env={env} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function Dashboard() {
  const qc = useQueryClient()

  const { data: groups = [], isLoading, isError, error } = useQuery<DashboardGroup[]>({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.get,
    refetchInterval: 15_000,
    retry: 3,
  })

  const [showAddGroup, setShowAddGroup] = useState(false)
  const [groupForm, setGroupForm] = useState({ name: '', description: '' })
  const [groupError, setGroupError] = useState('')

  const [showAddProject, setShowAddProject] = useState(false)
  const [projectForm, setProjectForm] = useState({ name: '', packageId: '', description: '', groupId: '' })
  const [projectError, setProjectError] = useState('')

  const createGroupMutation = useMutation({
    mutationFn: () => projectGroupsApi.create(groupForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setShowAddGroup(false)
      setGroupForm({ name: '', description: '' })
      setGroupError('')
    },
    onError: (e: any) => setGroupError(e.response?.data?.error ?? 'Failed to create group'),
  })

  const createProjectMutation = useMutation({
    mutationFn: () => projectsApi.create({
      name: projectForm.name,
      packageId: projectForm.packageId || null,
      description: projectForm.description || null,
      groupId: projectForm.groupId || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setShowAddProject(false)
      setProjectForm({ name: '', packageId: '', description: '', groupId: '' })
      setProjectError('')
    },
    onError: (e: any) => setProjectError(e.response?.data?.error ?? 'Failed to create project'),
  })

  const namedGroups = groups.filter(g => g.groupId !== null)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Projects</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-green" onClick={() => setShowAddGroup(true)}>Add Project Group</button>
          <button className="btn btn-green" onClick={() => setShowAddProject(true)}>Add Project</button>
        </div>
      </div>

      {isLoading ? (
        <div className="empty-state">Loading…</div>
      ) : isError ? (
        <div className="empty-state" style={{ color: 'var(--color-error)' }}>
          Error loading projects: {(error as any)?.response?.status} {(error as any)?.message}
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state">No projects yet. Create your first project.</div>
      ) : (
        groups.map(group => (
          <GroupCard key={group.groupId ?? 'ungrouped'} group={group} />
        ))
      )}

      {/* ── Add Project Group modal ── */}
      {showAddGroup && (
        <div className="modal-overlay" onClick={() => setShowAddGroup(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Project Group</div>
            {groupError && <div className="error-msg">{groupError}</div>}
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={groupForm.name}
                onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={groupForm.description}
                onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddGroup(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!groupForm.name || createGroupMutation.isPending}
                onClick={() => createGroupMutation.mutate()}>
                {createGroupMutation.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Project modal ── */}
      {showAddProject && (
        <div className="modal-overlay" onClick={() => setShowAddProject(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Project</div>
            {projectError && <div className="error-msg">{projectError}</div>}
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={projectForm.name}
                onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Package ID</label>
              <input className="form-input" placeholder="e.g. MyApp.Api" value={projectForm.packageId}
                onChange={e => setProjectForm(f => ({ ...f, packageId: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={projectForm.description}
                onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            {namedGroups.length > 0 && (
              <div className="form-group">
                <label className="form-label">Group</label>
                <select className="form-input" value={projectForm.groupId}
                  onChange={e => setProjectForm(f => ({ ...f, groupId: e.target.value }))}>
                  <option value="">— No group —</option>
                  {namedGroups.map(g => (
                    <option key={g.groupId} value={g.groupId!}>{g.groupName}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddProject(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!projectForm.name || createProjectMutation.isPending}
                onClick={() => createProjectMutation.mutate()}>
                {createProjectMutation.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
