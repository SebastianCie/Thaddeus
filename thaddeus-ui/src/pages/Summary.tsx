import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { agentsApi, deploymentsApi } from '../api/client'
import { StatusBadge } from '../components/common/StatusBadge'
import type { Agent, Deployment } from '../types'
import { formatDistanceToNow } from 'date-fns'

export function Summary() {
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: agentsApi.list,
    refetchInterval: 15_000,
  })

  const { data: deployments = [] } = useQuery<Deployment[]>({
    queryKey: ['deployments'],
    queryFn: () => deploymentsApi.list(10),
    refetchInterval: 10_000,
  })

  const onlineCount = agents.filter(a => a.status === 'ONLINE').length
  const failedCount = deployments.filter(d => d.status === 'FAILED').length
  const runningCount = deployments.filter(d => d.status === 'RUNNING').length

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Summary</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>{onlineCount}</div>
          <div className="stat-label">Deployment Targets Online</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--color-primary)' }}>{runningCount}</div>
          <div className="stat-label">Running Deployments</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--color-error)' }}>{failedCount}</div>
          <div className="stat-label">Failed (last 10)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{agents.length}</div>
          <div className="stat-label">Total Deployment Targets</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16, fontSize: 14, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
          Recent Deployments
        </h2>
        {deployments.length === 0 ? (
          <div className="empty-state">No deployments yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Release</th>
                  <th>Created By</th>
                  <th>When</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {deployments.map(d => (
                  <tr key={d.id}>
                    <td><StatusBadge status={d.status} /></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.releaseId.slice(0, 8)}…</td>
                    <td>{d.createdBy || '—'}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}
                    </td>
                    <td>
                      <Link to={`/deployments/${d.id}`} className="btn btn-sm btn-secondary">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
