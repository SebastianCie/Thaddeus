import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { lifecyclesApi } from '../api/client'
import type { LifecycleListItem } from '../types'
import { format } from 'date-fns'

export function DeploymentLifecycles() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: lifecycles = [], isLoading } = useQuery<LifecycleListItem[]>({
    queryKey: ['lifecycles'],
    queryFn: lifecyclesApi.list,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => lifecyclesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lifecycles'] }),
    onError: (e: any) => setDeleteError(e.response?.data?.error ?? 'Could not delete lifecycle.'),
  })

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Deployment Lifecycles</h1>
        <button className="btn btn-green" onClick={() => navigate('/library/lifecycles/new')}>Add Lifecycle</button>
      </div>

      {deleteError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-error)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', fontSize: 16 }}>×</button>
        </div>
      )}

      {isLoading ? <div className="loading">Loading…</div> : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Phases</th>
                <th>Projects</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lifecycles.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state">No lifecycles yet. Create one to get started.</div></td></tr>
              ) : lifecycles.map(lc => (
                <tr key={lc.id}>
                  <td style={{ fontWeight: 500 }}>{lc.name}</td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{lc.description || '—'}</td>
                  <td>
                    <span className="badge badge-pending">{lc.phaseCount} {lc.phaseCount === 1 ? 'phase' : 'phases'}</span>
                  </td>
                  <td>
                    <span className={`badge ${lc.projectCount > 0 ? 'badge-success' : 'badge-pending'}`}>
                      {lc.projectCount} {lc.projectCount === 1 ? 'project' : 'projects'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {format(new Date(lc.createdAt), 'yyyy-MM-dd')}
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/library/lifecycles/${lc.id}`)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={lc.projectCount > 0}
                      title={lc.projectCount > 0 ? `Used by ${lc.projectCount} project(s) — remove the reference first` : undefined}
                      onClick={() => { if (confirm(`Delete lifecycle "${lc.name}"?`)) deleteMutation.mutate(lc.id) }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
