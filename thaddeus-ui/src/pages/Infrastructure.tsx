import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi, environmentsApi } from '../api/client'
import { StatusBadge } from '../components/common/StatusBadge'
import type { Agent, Environment } from '../types'
import { formatDistanceToNow } from 'date-fns'

export function Infrastructure() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'agents' | 'environments'>('agents')

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ['agents'], queryFn: agentsApi.list, refetchInterval: 15_000,
  })
  const { data: environments = [] } = useQuery<Environment[]>({
    queryKey: ['environments'], queryFn: environmentsApi.list,
  })

  const [showEnvModal, setShowEnvModal] = useState(false)
  const [envForm, setEnvForm] = useState({ name: '', description: '', color: '#6366f1' })
  const createEnvMutation = useMutation({
    mutationFn: () => environmentsApi.create(envForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['environments'] }); setShowEnvModal(false) },
  })
  const deleteEnvMutation = useMutation({
    mutationFn: (id: string) => environmentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments'] }),
  })

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Infrastructure</h1>
        {tab === 'environments' && (
          <button className="btn btn-primary" onClick={() => setShowEnvModal(true)}>+ New Environment</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
        {(['agents', 'environments'] as const).map(t => (
          <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
        ))}
      </div>

      {tab === 'agents' && (
        agentsLoading ? <div className="loading">Loading…</div> : (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead><tr><th>Status</th><th>Hostname</th><th>IP</th><th>OS</th><th>Version</th><th>Environments</th><th>Last Seen</th></tr></thead>
              <tbody>
                {agents.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state">No agents registered.</div></td></tr>
                ) : agents.map(a => (
                  <tr key={a.id}>
                    <td><StatusBadge status={a.status} /></td>
                    <td style={{ fontWeight: 500 }}>{a.hostname}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.ip}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{a.osVersion}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.agentVersion}</td>
                    <td style={{ fontSize: 12 }}>
                      {a.agentEnvironments?.map(e => (
                        <span key={e.id} className="badge badge-pending" style={{ marginRight: 4 }}>{e.name}</span>
                      ))}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {formatDistanceToNow(new Date(a.lastSeenAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'environments' && (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Name</th><th>Color</th><th>Description</th><th></th></tr></thead>
            <tbody>
              {environments.length === 0 ? (
                <tr><td colSpan={4}><div className="empty-state">No environments. Create one to get started.</div></td></tr>
              ) : environments.map(env => (
                <tr key={env.id}>
                  <td style={{ fontWeight: 500 }}>{env.name}</td>
                  <td><span style={{ width: 14, height: 14, borderRadius: '50%', background: env.color, display: 'inline-block', marginRight: 8 }} />{env.color}</td>
                  <td style={{ color: 'var(--color-text-muted)' }}>{env.description || '—'}</td>
                  <td>
                    <button className="btn btn-sm btn-danger"
                      onClick={() => { if (confirm(`Delete environment "${env.name}"?`)) deleteEnvMutation.mutate(env.id) }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showEnvModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Create Environment</div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={envForm.name} onChange={e => setEnvForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={envForm.description} onChange={e => setEnvForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <input type="color" value={envForm.color} onChange={e => setEnvForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: '100%', height: 36, border: 'none', cursor: 'pointer', background: 'none' }} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowEnvModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => createEnvMutation.mutate()} disabled={!envForm.name}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
