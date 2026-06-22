import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditApi } from '../api/client'
import type { AuditLog } from '../types'
import { format } from 'date-fns'

export function Configuration() {
  const [tab, setTab] = useState<'audit'>('audit')
  const [page, setPage] = useState(0)

  const { data: auditLogs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ['audit', page],
    queryFn: () => auditApi.list(page, 50),
  })

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Configuration</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
        <button className={`btn btn-sm ${tab === 'audit' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('audit')}>
          Audit Log
        </button>
      </div>

      {isLoading ? <div className="loading">Loading…</div> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>User</th><th>Action</th><th>Resource</th><th>ID</th></tr></thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state">No audit entries.</div></td></tr>
                ) : auditLogs.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{format(new Date(a.timestamp), 'yyyy-MM-dd HH:mm:ss')}</td>
                    <td style={{ fontSize: 12 }}>{a.username || a.userId}</td>
                    <td><span className="badge badge-pending" style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.action}</span></td>
                    <td style={{ fontSize: 12 }}>{a.resourceType}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {a.resourceId?.slice(0, 12)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--color-border)' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ lineHeight: '28px', color: 'var(--color-text-muted)', fontSize: 12 }}>Page {page + 1}</span>
            <button className="btn btn-secondary btn-sm" disabled={auditLogs.length < 50} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}
