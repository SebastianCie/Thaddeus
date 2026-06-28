import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { dashboardApi, projectsApi, projectGroupsApi } from '../api/client'
import type { DashboardGroup, DashboardProject } from '../types'

// ── Project Avatar ────────────────────────────────────────────────────────────

function ProjectAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const hue = name.split('').reduce((n, c) => n + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 8, background: `hsl(${hue},40%,45%)`,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

// ── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: DashboardProject }) {
  const deployed = [...project.environments]
    .filter(e => e.deployedAt !== null)
    .sort((a, b) => new Date(b.deployedAt!).getTime() - new Date(a.deployedAt!).getTime())
  const last = deployed[0] ?? null
  const stripColor = last?.environmentColor ?? '#3a3a3a'

  return (
    <Link
      to={`/projects/${project.projectId}/dashboard`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div
        className="card"
        style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'row', cursor: 'pointer', transition: 'border-color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
      >
        <div style={{ width: 5, background: stripColor, flexShrink: 0 }} />

        <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <ProjectAvatar name={project.projectName} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {project.projectName}
              </div>
              {project.description && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {project.description}
                </div>
              )}
            </div>
          </div>

          {last ? (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', color: 'var(--color-text)', fontWeight: 500 }}>{last.releaseVersion}</span>
              <span>·</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: last.environmentColor, display: 'inline-block', flexShrink: 0 }} />
                {last.environmentName}
              </span>
              <span>·</span>
              <span>{formatDistanceToNow(new Date(last.deployedAt!), { addSuffix: true })}</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Never deployed</div>
          )}

          {deployed.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {deployed.map(env => (
                <span key={env.environmentId} style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 20,
                  background: `${env.environmentColor}22`,
                  border: `1px solid ${env.environmentColor}55`,
                  color: env.environmentColor,
                  fontWeight: 500,
                }}>
                  {env.environmentName}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Group Section ─────────────────────────────────────────────────────────────

function GroupSection({ group }: { group: DashboardGroup }) {
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

      {group.projects.length === 0 ? (
        <div className="empty-state">No projects in this group.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {group.projects.map(project => (
            <ProjectCard key={project.projectId} project={project} />
          ))}
        </div>
      )}
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
          <GroupSection key={group.groupId ?? 'ungrouped'} group={group} />
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
