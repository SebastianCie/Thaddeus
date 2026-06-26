import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { dashboardApi } from '../api/client'
import type { ProjectDashboardEnvironmentStatus, ProjectDashboardView, DeploymentStatus } from '../types'

// ── Status cell ───────────────────────────────────────────────────────────────

function StatusCell({ env }: { env: ProjectDashboardEnvironmentStatus }) {
  if (!env.status) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)' }}>
        <span style={{ fontSize: 18, opacity: 0.5 }}>⊘</span>
        <span style={{ fontSize: 13 }}>No Data</span>
      </div>
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
    ? format(new Date(env.deployedAt), 'MMM d, yyyy h:mm aa')
    : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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

  const { data, isLoading, isError } = useQuery<ProjectDashboardView>({
    queryKey: ['project-dashboard', id],
    queryFn: () => dashboardApi.getProject(id!),
    refetchInterval: 15_000,
    enabled: !!id,
  })

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
        <Link to={`/projects/${id}`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
          Projekt öffnen
        </Link>
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
            <table style={{ minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ width: 160, paddingLeft: 20 }}></th>
                  {environments.map(env => (
                    <th key={env.environmentId} style={{
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      paddingTop: 14,
                      paddingBottom: 14,
                      minWidth: 180,
                    }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
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
                    <td style={{ paddingLeft: 20, paddingRight: 16, paddingTop: 14, paddingBottom: 14 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{release.version}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {format(new Date(release.createdAt), 'MMM d, yyyy')}
                      </div>
                    </td>
                    {release.environments.map(env => (
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
      )}
    </div>
  )
}
