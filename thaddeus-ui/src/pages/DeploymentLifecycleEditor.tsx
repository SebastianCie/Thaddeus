import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { lifecyclesApi, environmentsApi } from '../api/client'
import type { DeploymentLifecycle, Environment } from '../types'

type PhaseForm = {
  key: number
  name: string
  optional: boolean
  autoDeploy: boolean
  environmentIds: string[]
}

let keyCounter = 0
function nextKey() { return ++keyCounter }

export function DeploymentLifecycleEditor() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: existing } = useQuery<DeploymentLifecycle>({
    queryKey: ['lifecycle', id],
    queryFn: () => lifecyclesApi.get(id!),
    enabled: !isNew,
  })
  const { data: environments = [] } = useQuery<Environment[]>({
    queryKey: ['environments'],
    queryFn: environmentsApi.list,
  })

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [phases, setPhases] = useState<PhaseForm[]>([])
  const [error, setError] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setDescription(existing.description ?? '')
      setPhases(existing.phases.map(p => ({
        key: nextKey(),
        name: p.name,
        optional: p.optional,
        autoDeploy: p.autoDeploy,
        environmentIds: p.environments.map(e => e.id),
      })))
    }
  }, [existing])

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        name,
        description: description || null,
        phases: phases.map(p => ({
          name: p.name,
          optional: p.optional,
          autoDeploy: p.autoDeploy,
          environmentIds: p.environmentIds,
        })),
      }
      return isNew ? lifecyclesApi.create(body) : lifecyclesApi.update(id!, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lifecycles'] })
      navigate('/library/lifecycles')
    },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Failed to save lifecycle.'),
  })

  function addPhase() {
    setPhases(prev => [...prev, { key: nextKey(), name: '', optional: false, autoDeploy: false, environmentIds: [] }])
  }

  function removePhase(key: number) {
    setPhases(prev => prev.filter(p => p.key !== key))
  }

  function updatePhase(key: number, patch: Partial<PhaseForm>) {
    setPhases(prev => prev.map(p => p.key === key ? { ...p, ...patch } : p))
  }

  function toggleEnv(phaseKey: number, envId: string) {
    setPhases(prev => prev.map(p => {
      if (p.key !== phaseKey) return p
      const has = p.environmentIds.includes(envId)
      return { ...p, environmentIds: has ? p.environmentIds.filter(e => e !== envId) : [...p.environmentIds, envId] }
    }))
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault() }
  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return
    const updated = [...phases]
    const [moved] = updated.splice(dragIndex, 1)
    updated.splice(targetIndex, 0, moved)
    setPhases(updated)
    setDragIndex(null)
  }

  const usedEnvIds = new Set(phases.flatMap(p => p.environmentIds))
  const canSave = name.trim() && phases.length > 0 && phases.every(p => p.name.trim() && p.environmentIds.length > 0)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{isNew ? 'Add Lifecycle' : 'Edit Lifecycle'}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/library/lifecycles')}>Cancel</button>
          <button className="btn btn-green" disabled={!canSave || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* ── General ── */}
      <div className="card" style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 16 }}>General</div>
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Description</label>
          <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
      </div>

      {/* ── Phases ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>
          Phases
          <span style={{ marginLeft: 8, background: 'var(--color-surface-2,#2a2a2a)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '1px 8px', fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 400 }}>
            {phases.length}
          </span>
        </div>
        <button className="btn btn-green" onClick={addPhase}>+ Add Phase</button>
      </div>

      {phases.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
          No phases yet. Add at least one phase to continue.
        </div>
      )}

      {phases.map((phase, index) => (
        <div
          key={phase.key}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(index)}
          className="card"
          style={{
            marginBottom: 12,
            padding: 16,
            cursor: 'grab',
            opacity: dragIndex === index ? 0.5 : 1,
            borderLeft: '3px solid var(--color-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 16, cursor: 'grab', userSelect: 'none' }}>⋮⋮</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Phase {index + 1}
            </span>
            <div style={{ flex: 1 }}>
              <input
                className="form-input"
                value={phase.name}
                onChange={e => updatePhase(phase.key, { name: e.target.value })}
                placeholder="Phase name…"
                style={{ marginBottom: 0 }}
              />
            </div>
            <button
              onClick={() => removePhase(phase.key)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}
              title="Remove phase"
            >×</button>
          </div>

          <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={phase.optional} onChange={e => updatePhase(phase.key, { optional: e.target.checked })} />
              Optional phase
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={phase.autoDeploy} onChange={e => updatePhase(phase.key, { autoDeploy: e.target.checked })} />
              Auto-deploy when previous phase succeeds
            </label>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Environments *
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {environments.map(env => {
                const checked = phase.environmentIds.includes(env.id)
                const usedElsewhere = !checked && usedEnvIds.has(env.id)
                return (
                  <label
                    key={env.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, cursor: usedElsewhere ? 'not-allowed' : 'pointer',
                      background: checked ? 'rgba(99,102,241,0.15)' : 'var(--color-surface-2,#2a2a2a)',
                      border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      borderRadius: 6, padding: '4px 10px', fontSize: 13,
                      opacity: usedElsewhere ? 0.4 : 1,
                    }}
                    title={usedElsewhere ? 'Already used in another phase' : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={usedElsewhere}
                      onChange={() => !usedElsewhere && toggleEnv(phase.key, env.id)}
                      style={{ display: 'none' }}
                    />
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: env.color, flexShrink: 0 }} />
                    {env.name}
                  </label>
                )
              })}
              {environments.length === 0 && (
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No environments available.</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
