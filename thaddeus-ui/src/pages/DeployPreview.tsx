import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { releasesApi, environmentsApi, agentsApi, deploymentsApi, tasksApi } from '../api/client'
import type { Release, Environment, Agent, DeploymentTask, Deployment, DeploymentStatus, TaskLog } from '../types'

// ── Tab bar ───────────────────────────────────────────────────────────────────

function Tabs({ active, onChange }: { active: 'summary' | 'log'; onChange: (t: 'summary' | 'log') => void }) {
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
      {(['summary', 'log'] as const).map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            padding: '8px 20px',
            fontSize: 13,
            fontWeight: active === tab ? 600 : 400,
            background: 'none',
            border: 'none',
            borderBottom: active === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: active === tab ? 'var(--color-text)' : 'var(--color-text-muted)',
            cursor: 'pointer',
            marginBottom: -1,
          }}
        >
          {tab === 'summary' ? 'Task Summary' : 'Task Log'}
        </button>
      ))}
    </div>
  )
}

// ── Task log view ─────────────────────────────────────────────────────────────

function taskStatusColor(status: DeploymentStatus | string) {
  if (status === 'SUCCESS') return 'var(--color-success)'
  if (status === 'FAILED' || status === 'CANCELLED') return 'var(--color-error)'
  if (status === 'RUNNING') return 'var(--color-primary)'
  return 'var(--color-text-muted)'
}

function taskStatusIcon(status: DeploymentStatus | string) {
  if (status === 'SUCCESS') return '✓'
  if (status === 'FAILED' || status === 'CANCELLED') return '✕'
  if (status === 'RUNNING') return '⟳'
  return '…'
}

function TaskRow({ task, isActive }: { task: DeploymentTask; isActive: boolean }) {
  const [expanded, setExpanded] = useState(true)

  const { data: logs = [] } = useQuery<TaskLog[]>({
    queryKey: ['task-logs-live', task.id],
    queryFn: () => tasksApi.getLogs(task.id),
    refetchInterval: isActive ? 1500 : false,
  })

  const duration = task.startedAt && task.finishedAt
    ? ((new Date(task.finishedAt).getTime() - new Date(task.startedAt).getTime()) / 1000).toFixed(1)
    : null

  return (
    <div style={{ borderTop: '1px solid var(--color-border)' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '12px 20px',
          background: isActive ? 'rgba(99,102,241,0.05)' : undefined,
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: taskStatusColor(task.status),
          color: '#fff', fontSize: 13, fontWeight: 700,
        }}>
          {taskStatusIcon(task.status)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 500 }}>{task.stepType}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
            Step {task.stepPosition + 1}
            {duration && ` · ${duration}s`}
            {isActive && ' · Running…'}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: taskStatusColor(task.status) }}>
          {task.status}
        </span>
        <button
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', padding: '2px 6px',
            fontSize: 18, lineHeight: 1,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          ▾
        </button>
      </div>

      {expanded && (
        <div className="log-viewer" style={{ margin: '0 20px 14px', maxHeight: 280 }}>
          {(logs as TaskLog[]).length === 0 ? (
            <span style={{ color: 'var(--color-text-muted)' }}>{isActive ? 'Waiting for log output…' : 'No log entries.'}</span>
          ) : (
            (logs as TaskLog[]).map(log => (
              <div key={log.id} className="log-line">
                <span className="log-time">{new Date(log.loggedAt).toLocaleTimeString('de-DE')}</span>
                <span style={{ flexShrink: 0, minWidth: 40 }} className={`log-level-${log.level}`}>{log.level}</span>
                <span className={`log-level-${log.level}`} style={{ wordBreak: 'break-word' }}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function TaskLogView({ deploymentId }: { deploymentId: string | null }) {
  const { data: tasks = [] } = useQuery<DeploymentTask[]>({
    queryKey: ['deploy-tasks-live', deploymentId],
    queryFn: () => deploymentsApi.tasks(deploymentId!),
    enabled: !!deploymentId,
    refetchInterval: (query) => {
      const data = query.state.data as DeploymentTask[] | undefined
      if (!data) return 2000
      const active = data.some(t => t.status === 'PENDING' || t.status === 'RUNNING')
      return active ? 2000 : false
    },
  })

  if (!deploymentId) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
        Click <strong>Deploy</strong> to start the deployment and see live progress here.
      </div>
    )
  }

  const sorted = [...(tasks as DeploymentTask[])].sort((a, b) => a.stepPosition - b.stepPosition)
  const successCount = sorted.filter(t => t.status === 'SUCCESS').length
  const failedCount = sorted.filter(t => t.status === 'FAILED').length
  const isRunning = sorted.some(t => t.status === 'RUNNING' || t.status === 'PENDING')
  const isDone = sorted.length > 0 && !isRunning

  return (
    <>
      {isDone && (
        <div style={{
          padding: '10px 16px', borderRadius: 6, marginBottom: 16,
          background: failedCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
          border: `1px solid ${failedCount > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          fontSize: 13, fontWeight: 600,
          color: failedCount > 0 ? 'var(--color-error)' : 'var(--color-success)',
        }}>
          {failedCount > 0
            ? `Deployment finished with ${failedCount} failed step${failedCount > 1 ? 's' : ''}`
            : `Deployment successful — all ${successCount} steps completed`}
        </div>
      )}

      {sorted.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Waiting for tasks…</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {sorted.map(task => (
            <TaskRow key={task.id} task={task} isActive={task.status === 'RUNNING'} />
          ))}
        </div>
      )}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DeployPreview() {
  const { id, releaseId } = useParams<{ id: string; releaseId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const envId = searchParams.get('envId') ?? ''

  const urlDeploymentId = searchParams.get('deploymentId')
  const [activeTab, setActiveTab] = useState<'summary' | 'log'>(urlDeploymentId ? 'log' : 'summary')
  const [deploymentId, setDeploymentId] = useState<string | null>(urlDeploymentId)

  const { data: release, isLoading: loadingRelease } = useQuery<Release>({
    queryKey: ['release', id, releaseId],
    queryFn: () => releasesApi.get(id!, releaseId!),
    enabled: !!id && !!releaseId,
  })

  const { data: existingDeployments = [] } = useQuery<Deployment[]>({
    queryKey: ['release-deployments', releaseId, envId],
    queryFn: () => deploymentsApi.listByRelease(releaseId!, envId),
    enabled: !!releaseId && !!envId && !deploymentId,
  })

  useEffect(() => {
    const latest = (existingDeployments as Deployment[])[0]
    if (latest && !deploymentId) {
      setDeploymentId(latest.id)
      setActiveTab('log')
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.set('deploymentId', latest.id)
        return next
      }, { replace: true })
    }
  }, [existingDeployments])

  const { data: environments = [], isLoading: loadingEnvs } = useQuery<Environment[]>({
    queryKey: ['environments'],
    queryFn: () => environmentsApi.list(),
  })

  const { data: agents = [], isLoading: loadingAgents } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => agentsApi.list(),
  })

  const environment = (environments as Environment[]).find(e => e.id === envId)
  const envAgents = (agents as Agent[]).filter(a =>
    a.status !== 'DISABLED' &&
    a.agentEnvironments.some(e => e.id === envId)
  )
  const onlineCount = envAgents.filter(a => a.status === 'ONLINE').length

  let stepCount = 0
  try {
    if (release?.processSnapshotJson) stepCount = JSON.parse(release.processSnapshotJson).length
  } catch { stepCount = 0 }

  const deployMutation = useMutation({
    mutationFn: () => deploymentsApi.trigger(releaseId!, envId),
    onSuccess: (deployment: Deployment) => {
      setDeploymentId(deployment.id)
      setActiveTab('log')
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.set('deploymentId', deployment.id)
        return next
      }, { replace: true })
    },
  })

  const isLoading = loadingRelease || loadingEnvs || loadingAgents
  if (isLoading) return <div className="loading">Loading…</div>
  if (!release || !environment) return <div className="empty-state">Release or environment not found.</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
            <Link to={`/projects/${id}/dashboard`} style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>
              Dashboard
            </Link>
            {' / Deploy'}
          </div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Deploy Release <span style={{ fontFamily: 'monospace' }}>{release.version}</span>
          </h1>
        </div>
        <button
          className="btn btn-green"
          disabled={deployMutation.isPending}
          onClick={() => deployMutation.mutate()}
        >
          {deployMutation.isPending ? 'Deploying…' : 'Deploy'}
        </button>
      </div>

      {deployMutation.isError && (
        <div style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 16 }}>
          {(deployMutation.error as any)?.response?.data?.error ?? 'Deployment failed.'}
        </div>
      )}

      <Tabs active={activeTab} onChange={setActiveTab} />

      {activeTab === 'summary' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Environment</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: environment.color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 16, fontWeight: 600 }}>{environment.name}</span>
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Package</div>
              <div style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 600 }}>{release.packageId}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>Version: {release.packageVersion}</div>
            </div>

            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Process Steps</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{stepCount}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>steps will be executed</div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
              Deployment Targets
              <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 400, color: 'var(--color-text-muted)' }}>
                {onlineCount} of {envAgents.length} online
              </span>
            </div>

            {envAgents.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No agents assigned to this environment.</div>
            ) : (
              <table style={{ width: '100%' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Hostname', 'IP', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textTransform: 'uppercase', paddingBottom: 10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {envAgents.map((agent, i) => {
                    const isOnline = agent.status === 'ONLINE'
                    return (
                      <tr key={agent.id} style={{ borderTop: i === 0 ? undefined : '1px solid var(--color-border)' }}>
                        <td style={{ paddingTop: 12, paddingBottom: 12, paddingRight: 24, fontSize: 13, fontFamily: 'monospace' }}>{agent.hostname}</td>
                        <td style={{ paddingTop: 12, paddingBottom: 12, paddingRight: 24, fontSize: 13, color: 'var(--color-text-muted)' }}>{agent.ip}</td>
                        <td style={{ paddingTop: 12, paddingBottom: 12 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: isOnline ? 'var(--color-success)' : 'var(--color-error)' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: isOnline ? 'var(--color-success)' : 'var(--color-error)', display: 'inline-block' }} />
                            {agent.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <TaskLogView deploymentId={deploymentId} />
      )}
    </div>
  )
}
