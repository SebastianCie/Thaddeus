import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi, lifecyclesApi } from '../api/client'
import type { Project, LifecycleListItem } from '../types'

export function ProjectLifecycle() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data: project } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  })
  const { data: lifecycles = [] } = useQuery<LifecycleListItem[]>({
    queryKey: ['lifecycles'],
    queryFn: lifecyclesApi.list,
  })

  const [lifecycleId, setLifecycleId] = useState<string>('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (project) setLifecycleId(project.lifecycleId ?? '')
  }, [project])

  const saveMutation = useMutation({
    mutationFn: () => projectsApi.update(project!.id, {
      name: project!.name,
      description: project!.description,
      packageId: project!.packageId,
      groupId: project!.groupId,
      lifecycleId: lifecycleId || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const selected = lifecycles.find(lc => lc.id === lifecycleId)

  if (!project) return <div className="loading">Loading…</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Deployment Lifecycle</h1>
      </div>

      <div style={{ maxWidth: 520 }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="form-group">
            <label className="form-label">Lifecycle</label>
            <select className="form-input" value={lifecycleId} onChange={e => setLifecycleId(e.target.value)}>
              <option value="">— None —</option>
              {lifecycles.map(lc => (
                <option key={lc.id} value={lc.id}>{lc.name}</option>
              ))}
            </select>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
              Defines which environments must be passed through in order before a release can be promoted.
            </span>
          </div>

          {selected && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Phases ({selected.phaseCount})
              </div>
              {selected.phaseCount === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No phases defined.</span>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {selected.phaseCount} phase{selected.phaseCount !== 1 ? 's' : ''} — view details in Library → Deployment Lifecycles.
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-green" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            {saved && <span style={{ fontSize: 13, color: 'var(--color-success)' }}>Saved</span>}
            {saveMutation.isError && <span style={{ fontSize: 13, color: 'var(--color-error)' }}>Failed to save.</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
