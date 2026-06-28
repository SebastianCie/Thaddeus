import { useState, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { environmentsApi, agentsApi } from '../api/client'
import type { Environment, Agent } from '../types'
import { StatusBadge } from '../components/common/StatusBadge'

export function Environments() {
  const qc = useQueryClient()
  const { data: environments = [], isLoading } = useQuery<Environment[]>({
    queryKey: ['environments'], queryFn: environmentsApi.list,
  })
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents'], queryFn: agentsApi.list,
  })

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', color: '#6366f1' })
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', color: '#6366f1' })
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const createMutation = useMutation({
    mutationFn: () => environmentsApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['environments'] })
      setShowModal(false)
      setForm({ name: '', description: '', color: '#6366f1' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => environmentsApi.update(editingEnv!.id, editForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['environments'] }); setEditingEnv(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => environmentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments'] }),
    onError: (e: any) => setDeleteError(e.response?.data?.error ?? 'This environment could not be deleted.'),
  })

  function openEdit(env: Environment) {
    setEditForm({ name: env.name, description: env.description ?? '', color: env.color })
    setEditingEnv(env)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function targetsFor(envId: string): Agent[] {
    return agents.filter(a => a.agentEnvironments.some(e => e.id === envId))
  }

  function TargetCounts({ envId }: { envId: string }) {
    const targets = targetsFor(envId)
    const healthy = targets.filter(a => a.status === 'ONLINE').length
    const unavailable = targets.filter(a => a.status === 'OFFLINE').length
    const disabled = targets.filter(a => a.status === 'DISABLED').length
    return (
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="has-tooltip" data-tooltip="Healthy" style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-success)', background: 'rgba(34,197,94,0.12)', borderRadius: 12, padding: '1px 8px' }}>{healthy}</span>
        <span className="has-tooltip" data-tooltip="Unavailable" style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-muted)', background: 'rgba(107,114,128,0.12)', borderRadius: 12, padding: '1px 8px' }}>{unavailable}</span>
        <span className="has-tooltip" data-tooltip="Disabled" style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-warning)', background: 'rgba(245,158,11,0.1)', borderRadius: 12, padding: '1px 8px' }}>{disabled}</span>
      </span>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Environments</h1>
        <button className="btn btn-green" onClick={() => setShowModal(true)}>Add Environment</button>
      </div>

      {deleteError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-error)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {isLoading ? <div className="loading">Loading…</div> : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Color</th>
                <th>Description</th>
                <th>Targets</th>
                <th></th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {environments.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state">No environments. Create one to get started.</div></td></tr>
              ) : environments.map(env => {
                const targets = targetsFor(env.id)
                const isOpen = expanded.has(env.id)

                return (
                  <Fragment key={env.id}>
                    <tr>
                      <td style={{ fontWeight: 500 }}>{env.name}</td>
                      <td>
                        <span style={{ width: 14, height: 14, borderRadius: '50%', background: env.color, display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} />
                        {env.color}
                      </td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{env.description || '—'}</td>
                      <td><TargetCounts envId={env.id} /></td>
                      <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(env)}>Edit</button>
                        <button className="btn btn-sm btn-danger"
                          onClick={() => { if (confirm(`Delete environment "${env.name}"?`)) deleteMutation.mutate(env.id) }}>
                          Delete
                        </button>
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        <button
                          onClick={() => toggleExpand(env.id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--color-text-muted)', padding: '2px 6px',
                            fontSize: 18, lineHeight: 1, display: 'inline-block',
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.15s ease',
                          }}
                        >
                          ▾
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <td colSpan={6} style={{ padding: '0 0 0 24px', borderTop: 'none' }}>
                          {targets.length === 0 ? (
                            <div style={{ padding: '10px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
                              No deployment targets assigned to this environment.
                            </div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', margin: '8px 0' }}>
                              <thead>
                                <tr>
                                  <th style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 12px 4px 0', textAlign: 'left', border: 'none' }}>Hostname</th>
                                  <th style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 12px 4px 0', textAlign: 'left', border: 'none' }}>IP</th>
                                  <th style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0', textAlign: 'left', border: 'none' }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {targets.map(agent => (
                                  <tr key={agent.id}>
                                    <td style={{ padding: '5px 12px 5px 0', border: 'none', fontFamily: 'monospace', fontSize: 13 }}>{agent.hostname}</td>
                                    <td style={{ padding: '5px 12px 5px 0', border: 'none', fontSize: 12, color: 'var(--color-text-muted)' }}>{agent.ip || '—'}</td>
                                    <td style={{ padding: '5px 0', border: 'none' }}><StatusBadge status={agent.status} /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Create Environment</div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: '100%', height: 36, border: 'none', cursor: 'pointer', background: 'none' }} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingEnv && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Edit Environment</div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <input type="color" value={editForm.color} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: '100%', height: 36, border: 'none', cursor: 'pointer', background: 'none' }} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditingEnv(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => updateMutation.mutate()}
                disabled={!editForm.name || updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
            {updateMutation.isError && (
              <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>Failed to save.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
