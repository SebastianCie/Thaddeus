import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { deploymentsApi } from '../api/client'
import { StatusBadge } from '../components/common/StatusBadge'
import type { Deployment } from '../types'
import { format } from 'date-fns'

export function Deployments() {
  const { data: deployments = [], isLoading } = useQuery<Deployment[]>({
    queryKey: ['deployments'],
    queryFn: () => deploymentsApi.list(100),
    refetchInterval: 10_000,
  })

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Deployments</h1>
      </div>
      {isLoading ? <div className="loading">Loading…</div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Status</th><th>Release</th><th>Environment</th><th>Created By</th><th>Started</th><th>Finished</th><th></th></tr></thead>
              <tbody>
                {deployments.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state">No deployments yet.</div></td></tr>
                ) : deployments.map(d => (
                  <tr key={d.id}>
                    <td><StatusBadge status={d.status} /></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.releaseId.slice(0, 8)}…</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.environmentId.slice(0, 8)}…</td>
                    <td>{d.createdBy || '—'}</td>
                    <td style={{ fontSize: 12 }}>{format(new Date(d.createdAt), 'yyyy-MM-dd HH:mm')}</td>
                    <td style={{ fontSize: 12 }}>{d.finishedAt ? format(new Date(d.finishedAt), 'HH:mm:ss') : '—'}</td>
                    <td><Link to={`/deployments/${d.id}`} className="btn btn-sm btn-secondary">View</Link></td>
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
