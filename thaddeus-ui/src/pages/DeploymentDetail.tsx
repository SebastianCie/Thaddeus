import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deploymentsApi, tasksApi } from '../api/client'
import { StatusBadge } from '../components/common/StatusBadge'
import type { Deployment, DeploymentTask, TaskLog } from '../types'
import { format } from 'date-fns'

// ── Live log viewer per task ────────────────────────────────────────────────

function TaskLogViewer({ task }: { task: DeploymentTask }) {
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [expanded, setExpanded] = useState(task.status === 'RUNNING')
  const sinceRef = useRef<string | undefined>(undefined)
  const logEndRef = useRef<HTMLDivElement>(null)
  const isActive = task.status === 'RUNNING' || task.status === 'PENDING'

  useEffect(() => {
    if (!expanded) return
    let active = true

    const poll = async () => {
      while (active && (task.status === 'RUNNING' || isActive)) {
        try {
          const newLogs: TaskLog[] = await tasksApi.getLogs(task.id, sinceRef.current)
          if (newLogs.length > 0) {
            sinceRef.current = newLogs[newLogs.length - 1].loggedAt
            setLogs(prev => [...prev, ...newLogs])
          }
        } catch (_) {}
        if (!active) break
        await new Promise(r => setTimeout(r, 2000))
      }
      // Final fetch after completion
      const final: TaskLog[] = await tasksApi.getLogs(task.id)
      if (active) setLogs(final)
    }

    poll()
    return () => { active = false }
  }, [task.id, expanded, task.status])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          background: 'var(--color-bg)', borderRadius: expanded ? '6px 6px 0 0' : 6,
          border: '1px solid var(--color-border)', cursor: 'pointer', userSelect: 'none'
        }}
      >
        <span style={{ color: 'var(--color-text-muted)' }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>Step {task.stepPosition}: {task.stepType}</span>
        <StatusBadge status={task.status} />
        {task.startedAt && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)' }}>
            {format(new Date(task.startedAt), 'HH:mm:ss')}
          </span>
        )}
      </div>
      {expanded && (
        <div className="log-viewer" style={{ borderRadius: '0 0 6px 6px', borderTop: 'none' }}>
          {logs.length === 0 ? (
            <span style={{ color: 'var(--color-text-muted)' }}>
              {isActive ? 'Waiting for logs...' : 'No logs available.'}
            </span>
          ) : (
            logs.map(l => (
              <div key={l.id} className="log-line">
                <span className="log-time">{format(new Date(l.loggedAt), 'HH:mm:ss.SSS')}</span>
                <span className={`log-level-${l.level}`}>[{l.level}]</span>
                <span>{l.message}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  )
}

// ── Deployment Detail Page ──────────────────────────────────────────────────

export function DeploymentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: deployment, isLoading } = useQuery<Deployment>({
    queryKey: ['deployment', id],
    queryFn: () => deploymentsApi.get(id!),
    refetchInterval: d => (d.state.data?.status === 'RUNNING' ? 3000 : false),
    enabled: !!id,
  })

  const { data: tasks = [] } = useQuery<DeploymentTask[]>({
    queryKey: ['deployment-tasks', id],
    queryFn: () => deploymentsApi.tasks(id!),
    refetchInterval: d => {
      const anyActive = d.state.data?.some(t => t.status === 'RUNNING' || t.status === 'PENDING')
      return anyActive ? 3000 : false
    },
    enabled: !!id,
  })

  const cancelMutation = useMutation({
    mutationFn: () => deploymentsApi.cancel(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deployment', id] }),
  })

  if (isLoading) return <div className="loading">Loading…</div>
  if (!deployment) return <div className="page"><div className="error-msg">Deployment not found.</div></div>

  const canCancel = deployment.status === 'RUNNING' || deployment.status === 'PENDING'

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} className="btn btn-secondary btn-sm">← Back</button>
          <h1 className="page-title">Deployment</h1>
          <StatusBadge status={deployment.status} />
        </div>
        {canCancel && (
          <button
            className="btn btn-danger"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
          >
            Cancel Deployment
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {[
            ['Release ID', deployment.releaseId.slice(0, 8) + '…'],
            ['Environment', deployment.environmentId.slice(0, 8) + '…'],
            ['Created By', deployment.createdBy || '—'],
            ['Started', format(new Date(deployment.createdAt), 'yyyy-MM-dd HH:mm:ss')],
            ['Finished', deployment.finishedAt ? format(new Date(deployment.finishedAt), 'HH:mm:ss') : '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{k}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <h2 style={{ fontSize: 14, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 12, letterSpacing: '0.05em' }}>
        Tasks ({tasks.length})
      </h2>

      {tasks.length === 0 ? (
        <div className="empty-state">No tasks created yet.</div>
      ) : (
        tasks.map(task => <TaskLogViewer key={task.id} task={task} />)
      )}
    </div>
  )
}
