import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { releasesApi, environmentsApi, deploymentsApi, projectsApi, lifecyclesApi } from '../api/client'
import type { Release, Environment, DeploymentTask, DeploymentStatus, Project, LifecycleListItem } from '../types'

function statusColor(status: DeploymentStatus | string): string {
  if (status === 'SUCCESS') return 'var(--color-success)'
  if (status === 'RUNNING' || status === 'PENDING') return 'var(--color-primary)'
  return 'var(--color-error)'
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 600,
      color: statusColor(status as DeploymentStatus),
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(status as DeploymentStatus), display: 'inline-block' }} />
      {status}
    </span>
  )
}

function DeploymentDetail({ releaseId, envId, deploymentId, projectId }: {
  releaseId: string
  envId: string
  deploymentId: string
  projectId: string
}) {
  const navigate = useNavigate()

  const { data: releases = [] } = useQuery<Release[]>({
    queryKey: ['releases', projectId],
    queryFn: () => releasesApi.list(projectId),
    enabled: !!projectId,
  })

  const { data: environments = [] } = useQuery<Environment[]>({
    queryKey: ['environments'],
    queryFn: () => environmentsApi.list(),
  })

  const { data: tasks = [], isLoading: loadingTasks } = useQuery<DeploymentTask[]>({
    queryKey: ['deployment-tasks', deploymentId],
    queryFn: () => deploymentsApi.tasks(deploymentId),
    enabled: !!deploymentId,
  })

  const release = (releases as Release[]).find(r => r.id === releaseId)
  const environment = (environments as Environment[]).find(e => e.id === envId)
  const lastDeployedAt = (tasks as DeploymentTask[]).reduce<string | null>((latest, t) => {
    if (!t.finishedAt) return latest
    if (!latest) return t.finishedAt
    return t.finishedAt > latest ? t.finishedAt : latest
  }, null)

  const successCount = (tasks as DeploymentTask[]).filter(t => t.status === 'SUCCESS').length
  const failedCount = (tasks as DeploymentTask[]).filter(t => t.status === 'FAILED').length

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Last Deployment
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 16, fontFamily: 'monospace' }}>
              {release?.version ?? releaseId}
            </span>
            {environment && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: environment.color, display: 'inline-block' }} />
                {environment.name}
              </span>
            )}
            {lastDeployedAt && (
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {format(new Date(lastDeployedAt), 'MMM d, yyyy HH:mm')}
              </span>
            )}
          </div>
          {tasks.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
              {successCount} passed · {failedCount > 0 ? <span style={{ color: 'var(--color-error)' }}>{failedCount} failed</span> : '0 failed'}
            </div>
          )}
        </div>
        <button
          className="btn btn-green"
          onClick={() => navigate(`/projects/${projectId}/releases/${releaseId}/deploy?envId=${envId}`)}
        >
          Re-deploy
        </button>
      </div>

      {loadingTasks ? (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading steps…</div>
      ) : tasks.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No step data available.</div>
      ) : (
        <table style={{ width: '100%' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Step', 'Type', 'Status', 'Started', 'Finished'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textTransform: 'uppercase', paddingBottom: 8, paddingRight: 20 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(tasks as DeploymentTask[])
              .slice()
              .sort((a, b) => a.stepPosition - b.stepPosition)
              .map((task, i) => (
                <tr key={task.id} style={{ borderTop: i === 0 ? undefined : '1px solid var(--color-border)' }}>
                  <td style={{ paddingTop: 10, paddingBottom: 10, paddingRight: 20, fontSize: 13, color: 'var(--color-text-muted)' }}>
                    #{task.stepPosition + 1}
                  </td>
                  <td style={{ paddingTop: 10, paddingBottom: 10, paddingRight: 20, fontSize: 12, fontFamily: 'monospace' }}>
                    {task.stepType}
                  </td>
                  <td style={{ paddingTop: 10, paddingBottom: 10, paddingRight: 20 }}>
                    <StatusBadge status={task.status} />
                  </td>
                  <td style={{ paddingTop: 10, paddingBottom: 10, paddingRight: 20, fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {task.startedAt ? format(new Date(task.startedAt), 'HH:mm:ss') : '—'}
                  </td>
                  <td style={{ paddingTop: 10, paddingBottom: 10, fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {task.finishedAt ? format(new Date(task.finishedAt), 'HH:mm:ss') : '—'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function ProjectReleases() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()

  const releaseId = searchParams.get('releaseId')
  const envId = searchParams.get('envId')
  const deploymentId = searchParams.get('deploymentId')
  const showDetail = !!(releaseId && envId && deploymentId)

  const { data: releases = [], isLoading } = useQuery<Release[]>({
    queryKey: ['releases', id],
    queryFn: () => releasesApi.list(id!),
    enabled: !!id,
  })

  const { data: project } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  })

  const { data: lifecycles = [] } = useQuery<LifecycleListItem[]>({
    queryKey: ['lifecycles'],
    queryFn: () => lifecyclesApi.list(),
    enabled: !!project?.lifecycleId,
  })

  const currentLifecycleName = (lifecycles as LifecycleListItem[])
    .find(lc => lc.id === project?.lifecycleId)?.name ?? null

  if (isLoading) return <div className="loading">Loading…</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Releases</h1>
      </div>

      {showDetail && (
        <DeploymentDetail
          releaseId={releaseId}
          envId={envId}
          deploymentId={deploymentId}
          projectId={id!}
        />
      )}

      {releases.length === 0 ? (
        <div className="empty-state">No releases yet. Create one from the Dashboard.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Version', 'Assembled', 'Lifecycle', 'Package', 'Release Notes'].map(h => (
                  <th key={h} style={{ paddingLeft: 20, paddingTop: 14, paddingBottom: 14, textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(releases as Release[]).map((release, i) => {
                const isActive = release.id === releaseId
                return (
                  <tr key={release.id} style={{
                    borderTop: i === 0 ? undefined : '1px solid var(--color-border)',
                    background: isActive ? 'rgba(var(--color-primary-rgb, 99,102,241),0.07)' : undefined,
                  }}>
                    <td style={{ paddingLeft: 20, paddingTop: 14, paddingBottom: 14, paddingRight: 24 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, fontFamily: 'monospace' }}>{release.version}</span>
                    </td>
                    <td style={{ paddingLeft: 20, paddingTop: 14, paddingBottom: 14, paddingRight: 24 }}>
                      <div style={{ fontSize: 13 }}>{format(new Date(release.createdAt), 'MMM d, yyyy')}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {format(new Date(release.createdAt), 'HH:mm')}
                      </div>
                    </td>
                    <td style={{ paddingLeft: 20, paddingTop: 14, paddingBottom: 14, paddingRight: 24 }}>
                      {release.lifecycleName
                        ? <span style={{ fontSize: 13 }}>{release.lifecycleName}</span>
                        : currentLifecycleName
                          ? <span style={{ fontSize: 13 }}>{currentLifecycleName}</span>
                          : <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td style={{ paddingLeft: 20, paddingTop: 14, paddingBottom: 14, paddingRight: 24 }}>
                      <div style={{ fontSize: 13, fontFamily: 'monospace' }}>{release.packageId}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{release.packageVersion}</div>
                    </td>
                    <td style={{ paddingLeft: 20, paddingTop: 14, paddingBottom: 14, paddingRight: 24, maxWidth: 300 }}>
                      {release.releaseNotes
                        ? <span style={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{release.releaseNotes}</span>
                        : <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
