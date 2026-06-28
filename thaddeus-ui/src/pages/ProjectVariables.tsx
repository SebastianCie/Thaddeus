import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi, environmentsApi } from '../api/client'
import type { Variable, Environment } from '../types'

export function ProjectVariables() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data: variables = [] } = useQuery<Variable[]>({
    queryKey: ['variables', id],
    queryFn: () => projectsApi.getVariables(id!),
    enabled: !!id,
  })
  const { data: environments = [] } = useQuery<Environment[]>({
    queryKey: ['environments'],
    queryFn: environmentsApi.list,
  })

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', value: '', isSecret: false, environmentId: '' })

  const createMutation = useMutation({
    mutationFn: () => projectsApi.createVariable(id!, { ...form, environmentId: form.environmentId || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['variables', id] })
      setShowModal(false)
      setForm({ name: '', value: '', isSecret: false, environmentId: '' })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (varId: string) => projectsApi.deleteVariable(id!, varId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['variables', id] }),
  })

  const envName = (envId: string | null) =>
    environments.find(e => e.id === envId)?.name ?? 'All Environments'

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Project Variables</h1>
        <button className="btn btn-green" onClick={() => setShowModal(true)}>+ Add Variable</button>
      </div>

      {variables.length === 0 ? (
        <div className="empty-state">No variables defined yet.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
                <th>Environment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {variables.map(v => (
                <tr key={v.id}>
                  <td style={{ fontFamily: 'monospace' }}>{v.name}</td>
                  <td style={{ fontFamily: 'monospace', color: v.isSecret ? 'var(--color-text-muted)' : undefined }}>
                    {v.isSecret ? '••••••••' : v.value}
                  </td>
                  <td style={{ fontSize: 12 }}>{envName(v.environmentId)}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteMutation.mutate(v.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Variable</div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Value</label>
              <input className="form-input" type={form.isSecret ? 'password' : 'text'} value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isSecret}
                  onChange={e => setForm(f => ({ ...f, isSecret: e.target.checked }))} />
                Secret (encrypted, masked in logs)
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">Environment Scope</label>
              <select className="form-select" value={form.environmentId}
                onChange={e => setForm(f => ({ ...f, environmentId: e.target.value }))}>
                <option value="">All Environments (default)</option>
                {environments.map(env => (
                  <option key={env.id} value={env.id}>{env.name}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary"
                onClick={() => createMutation.mutate()}
                disabled={!form.name || createMutation.isPending}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
