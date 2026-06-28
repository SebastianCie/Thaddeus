import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { dashboardApi, releasesApi, projectsApi, packagesApi } from '../api/client'
import type { ProjectDashboardEnvironmentStatus, ProjectDashboardView, DeploymentStatus, Project, Package } from '../types'

// ── Status cell ───────────────────────────────────────────────────────────────

function StatusCell({ env, releaseId, projectId }: {
  env: ProjectDashboardEnvironmentStatus
  releaseId: string
  projectId: string
}) {
  const navigate = useNavigate()

  if (!env.status) {
    return (
      <button
        className="btn btn-primary"
        style={{ fontSize: 12 }}
        onClick={() => navigate(`/projects/${projectId}/releases/${releaseId}/deploy?envId=${env.environmentId}`)}
      >
        Deploy
      </button>
    )
  }

  const isSuccess = env.status === 'SUCCESS'
  const isRunning = (env.status as DeploymentStatus) === 'RUNNING' || (env.status as DeploymentStatus) === 'PENDING'
  const bgColor = isSuccess
    ? 'var(--color-success)'
    : isRunning
    ? 'var(--color-primary)'
    : 'var(--color-error)'
  const icon = isSuccess ? '✓' : isRunning ? '⟳' : '✕'

  const dateStr = env.deployedAt
    ? format(new Date(env.deployedAt), 'MMM d, yyyy HH:mm')
    : null

  const target = `/projects/${projectId}/releases?releaseId=${releaseId}&envId=${env.environmentId}&deploymentId=${env.deploymentId ?? ''}`

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
      onClick={() => navigate(target)}
      title="View deployment details"
    >
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        background: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 15,
        fontWeight: 700,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      {dateStr && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.3 }}>{dateStr}</div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProjectDashboard() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery<ProjectDashboardView>({
    queryKey: ['project-dashboard', id],
    queryFn: () => dashboardApi.getProject(id!),
    refetchInterval: 15_000,
    enabled: !!id,
  })

  const { data: project } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  })

  const [showRelease, setShowRelease] = useState(false)
  const [releaseVersion, setReleaseVersion] = useState('')
  const [pkgVersionMode, setPkgVersionMode] = useState<'latest' | 'specific'>('latest')
  const [specificVersion, setSpecificVersion] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')

  const { data: pkgVersions = [] } = useQuery<Package[]>({
    queryKey: ['pkg-versions', project?.packageId],
    queryFn: () => packagesApi.versions(project!.packageId),
    enabled: showRelease && !!project?.packageId,
  })

  const latestVersion = (pkgVersions as Package[])[0]?.version ?? ''

  useEffect(() => {
    if (showRelease && latestVersion) {
      setReleaseVersion(prev => prev || latestVersion)
    }
  }, [showRelease, latestVersion])

  function openReleaseModal() {
    setReleaseVersion('')
    setPkgVersionMode('latest')
    setSpecificVersion('')
    setReleaseNotes('')
    setShowRelease(true)
  }

  const effectivePackageVersion = pkgVersionMode === 'latest' ? latestVersion : specificVersion

  const createReleaseMutation = useMutation({
    mutationFn: () => releasesApi.create(id!, {
      version: releaseVersion,
      packageId: project?.packageId ?? null,
      packageVersion: effectivePackageVersion,
      releaseNotes: releaseNotes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-dashboard', id] })
      setShowRelease(false)
    },
  })

  const canCreate = !!releaseVersion.trim() && !!effectivePackageVersion

  const environments = data?.releases[0]?.environments ?? []

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
            <Link to="/" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Dashboard</Link>
            {' / '}
            {data?.projectName ?? '…'}
          </div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            {data?.projectName ?? '…'}
          </h1>
        </div>
        <button className="btn btn-green" onClick={openReleaseModal}>+ Create Release</button>
      </div>

      {isLoading ? (
        <div className="empty-state">Lade…</div>
      ) : isError ? (
        <div className="empty-state">Fehler beim Laden.</div>
      ) : !data || data.releases.length === 0 ? (
        <div className="empty-state">Noch keine Releases vorhanden.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              tableLayout: 'fixed',
              width: 180 + environments.length * 200,
              borderCollapse: 'collapse',
            }}>
              <colgroup>
                <col style={{ width: 180 }} />
                {environments.map(env => <col key={env.environmentId} style={{ width: 200 }} />)}
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ paddingLeft: 20, paddingTop: 14, paddingBottom: 14 }} />
                  {environments.map(env => (
                    <th key={env.environmentId} style={{
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      paddingLeft: 20,
                      paddingTop: 14,
                      paddingBottom: 14,
                    }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: env.environmentColor,
                          flexShrink: 0,
                        }} />
                        {env.environmentName}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.releases.map((release, i) => (
                  <tr key={release.releaseId} style={{
                    borderTop: i === 0 ? undefined : '1px solid var(--color-border)',
                  }}>
                    <td style={{ paddingLeft: 20, paddingTop: 14, paddingBottom: 14 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{release.version}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {format(new Date(release.createdAt), 'MMM d, yyyy')}
                      </div>
                    </td>
                    {release.environments.map(env => (
                      <td key={env.environmentId} style={{ paddingLeft: 20, paddingTop: 14, paddingBottom: 14 }}>
                        <StatusCell env={env} releaseId={release.releaseId} projectId={id!} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showRelease && (
        <div className="modal-overlay" onClick={() => setShowRelease(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, width: '100%' }}>
            <div className="modal-title">Create Release for {data?.projectName ?? project?.name}</div>

            <div className="form-group">
              <label className="form-label">Release Version *</label>
              <input
                className="form-input"
                placeholder="e.g. 1.2.3 or 1.i"
                value={releaseVersion}
                onChange={e => setReleaseVersion(e.target.value)}
                autoFocus
              />
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                Use <code>i</code> to auto-increment: <code>1.i</code>, <code>1.15.i</code>, <code>2.i.i</code>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Package</label>
              {project?.packageId ? (
                <>
                  <div style={{ fontSize: 13, fontFamily: 'monospace', marginBottom: 10, color: 'var(--color-text-muted)' }}>
                    {project.packageId}
                  </div>
                  <div style={{ display: 'flex', gap: 0, marginBottom: 10 }}>
                    {(['latest', 'specific'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setPkgVersionMode(mode)}
                        style={{
                          padding: '5px 16px',
                          fontSize: 12,
                          border: '1px solid var(--color-border)',
                          borderRadius: mode === 'latest' ? '4px 0 0 4px' : '0 4px 4px 0',
                          cursor: 'pointer',
                          background: pkgVersionMode === mode ? 'var(--color-primary)' : 'transparent',
                          color: pkgVersionMode === mode ? '#fff' : 'inherit',
                          fontWeight: pkgVersionMode === mode ? 600 : 400,
                        }}
                      >
                        {mode === 'latest' ? 'Latest' : 'Specific'}
                      </button>
                    ))}
                  </div>
                  {pkgVersionMode === 'latest' ? (
                    <div style={{ fontSize: 13 }}>
                      {latestVersion
                        ? <span>Version: <code>{latestVersion}</code></span>
                        : <span style={{ color: 'var(--color-text-muted)' }}>No versions available</span>
                      }
                    </div>
                  ) : (
                    <select
                      className="form-input"
                      value={specificVersion}
                      onChange={e => setSpecificVersion(e.target.value)}
                    >
                      <option value="">Select version…</option>
                      {(pkgVersions as Package[]).map(p => (
                        <option key={p.version} value={p.version}>{p.version}</option>
                      ))}
                    </select>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '6px 0' }}>
                  No package configured. Set a Package ID in the Process Editor first.
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Release Notes</label>
              <textarea
                className="form-input"
                placeholder="What changed in this release?"
                value={releaseNotes}
                onChange={e => setReleaseNotes(e.target.value)}
                rows={5}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {createReleaseMutation.isError && (
              <p style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 8 }}>
                {(createReleaseMutation.error as any)?.response?.data?.error ?? 'Failed to create release.'}
              </p>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowRelease(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!canCreate || createReleaseMutation.isPending}
                onClick={() => createReleaseMutation.mutate()}
              >
                {createReleaseMutation.isPending ? 'Creating…' : 'Create Release'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
