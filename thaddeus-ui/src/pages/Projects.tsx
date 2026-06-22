import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { projectsApi } from '../api/client'
import type { Project } from '../types'

export function Projects() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', packageId: '' })
  const [error, setError] = useState('')

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: object) => projectsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      setShowModal(false)
      setForm({ name: '', description: '', packageId: '' })
    },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Failed to create project'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Projects</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Project</button>
      </div>

      {isLoading ? (
        <div className="loading">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 32, marginBottom: 8 }}>⬡</div>
          <div>No projects yet. Create your first project.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Package ID</th><th>Description</th><th></th></tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id}>
                    <td><Link to={`/projects/${p.id}`}>{p.name}</Link></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.packageId || '—'}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{p.description || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => { if (confirm(`Delete project "${p.name}"?`)) deleteMutation.mutate(p.id) }}
                      >Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Create Project</div>
            {error && <div className="error-msg">{error}</div>}
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Package ID</label>
              <input className="form-input" placeholder="e.g. MyApp.Api" value={form.packageId}
                onChange={e => setForm(f => ({ ...f, packageId: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!form.name || createMutation.isPending}
                onClick={() => createMutation.mutate(form)}
              >Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
