import { useState, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi, packagesApi } from '../api/client'
import type { DeploymentStep, Project, Package } from '../types'

function StepRolesEditor({ roles, onChange }: { roles: string[]; onChange: (roles: string[]) => void }) {
  const [input, setInput] = useState('')

  function add() {
    const name = input.trim().toLowerCase()
    if (name && !roles.includes(name)) onChange([...roles, name])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Roles:</span>
      {roles.length === 0
        ? <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>all deployment targets</span>
        : roles.map(r => (
          <span key={r} style={{ fontSize: 11, background: 'var(--color-surface-2,#2d2d2d)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
            {r}
            <button onClick={() => onChange(roles.filter(x => x !== r))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0, lineHeight: 1, fontSize: 12 }}>×</button>
          </span>
        ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        placeholder="add role…"
        style={{ fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 6px', background: 'transparent', color: 'inherit', width: 90 }}
      />
    </div>
  )
}

export function ProjectProcess() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data: project } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  })

  const { data: allPackages = [] } = useQuery<Package[]>({
    queryKey: ['packages-all'],
    queryFn: () => packagesApi.list(undefined, 0, 1000),
    staleTime: 60_000,
  })

  const [pkgSearch, setPkgSearch] = useState('')
  const [pkgOpen, setPkgOpen] = useState(false)
  const pkgRef = useRef<HTMLDivElement>(null)

  const uniquePkgIds = useMemo(() => {
    const ids = [...new Set((allPackages as Package[]).map(p => p.packageId))]
    if (!pkgSearch.trim()) return ids
    const q = pkgSearch.toLowerCase()
    return ids.filter(pkgId => pkgId.toLowerCase().includes(q))
  }, [allPackages, pkgSearch])

  const savePkgIdMutation = useMutation({
    mutationFn: (pkgId: string) => projectsApi.update(id!, { ...project, packageId: pkgId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] })
      setPkgSearch('')
    },
  })

  const { data: steps = [], isLoading } = useQuery<DeploymentStep[]>({
    queryKey: ['steps', id],
    queryFn: () => projectsApi.getSteps(id!),
    enabled: !!id,
  })

  const [localSteps, setLocalSteps] = useState<DeploymentStep[]>([])
  const [initialized, setInitialized] = useState(false)

  if (!initialized && steps.length >= 0 && !isLoading) {
    setLocalSteps(steps)
    setInitialized(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => projectsApi.replaceSteps(id!, localSteps.map(s => ({
      type: s.type,
      configJson: s.configJson,
      targetRoles: s.targetRoles ?? [],
    }))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steps', id] }),
  })

  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function updateRoles(i: number, roles: string[]) {
    setLocalSteps(s => s.map((step, j) => j === i ? { ...step, targetRoles: roles } : step))
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return
    const updated = [...localSteps]
    const [moved] = updated.splice(dragIndex, 1)
    updated.splice(targetIndex, 0, moved)
    setLocalSteps(updated)
    setDragIndex(null)
  }

  if (isLoading) return <div className="loading">Loading…</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Process Editor</h1>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Package ID</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div ref={pkgRef} style={{ position: 'relative', width: 340 }}>
            <input
              className="form-input"
              placeholder="Search package ID…"
              value={pkgSearch}
              onChange={e => setPkgSearch(e.target.value)}
              onFocus={() => setPkgOpen(true)}
              onBlur={() => setTimeout(() => setPkgOpen(false), 150)}
              style={{ width: '100%' }}
            />
            {pkgOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 2,
                background: 'var(--color-surface, #1e1e1e)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                zIndex: 100,
                maxHeight: '30vh',
                overflowY: 'auto',
              }}>
                {uniquePkgIds.length === 0 ? (
                  <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                    No packages found.
                  </div>
                ) : uniquePkgIds.map(pkgId => (
                  <div
                    key={pkgId}
                    onMouseDown={() => { savePkgIdMutation.mutate(pkgId); setPkgSearch(''); setPkgOpen(false) }}
                    style={{
                      padding: '8px 12px',
                      fontSize: 13,
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: pkgId === project?.packageId ? 'var(--color-primary)' : 'transparent',
                      color: pkgId === project?.packageId ? '#fff' : 'inherit',
                    }}
                    onMouseEnter={e => {
                      if (pkgId !== project?.packageId)
                        (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-2, #2d2d2d)'
                    }}
                    onMouseLeave={e => {
                      if (pkgId !== project?.packageId)
                        (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                    }}
                  >
                    {pkgId === project?.packageId && <span style={{ fontSize: 10 }}>✓</span>}
                    {pkgId}
                  </div>
                ))}
              </div>
            )}
          </div>
          {project?.packageId && (
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Selected: <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{project.packageId}</span>
            </div>
          )}
          {savePkgIdMutation.isPending && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Saving…</span>
          )}
        </div>
      </div>

      {localSteps.length === 0 && (
        <div className="empty-state" style={{ marginBottom: 16 }}>No steps defined. Add a step below.</div>
      )}

      {localSteps.map((step, i) => (
        <div
          key={i}
          draggable
          onDragStart={() => setDragIndex(i)}
          onDragOver={e => e.preventDefault()}
          onDrop={() => handleDrop(i)}
          className="card"
          style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8, opacity: dragIndex === i ? 0.4 : 1, cursor: 'grab' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 16, cursor: 'grab', userSelect: 'none' }}>⋮⋮</span>
            <span style={{ color: 'var(--color-text-muted)', minWidth: 20, fontSize: 12 }}>{i + 1}</span>
            <span className="badge badge-pending" style={{ fontFamily: 'monospace' }}>{step.type}</span>
            <textarea
              value={step.configJson}
              onChange={e => setLocalSteps(s => s.map((st, j) => j === i ? { ...st, configJson: e.target.value } : st))}
              rows={3}
              style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', background: 'var(--color-surface-2,#1e1e1e)', color: 'inherit', border: '1px solid var(--color-border)', borderRadius: 4, padding: '4px 8px', resize: 'vertical' }}
            />
            <button className="btn btn-sm btn-danger" onClick={() => setLocalSteps(s => s.filter((_, j) => j !== i))}>✕</button>
          </div>
          <StepRolesEditor roles={step.targetRoles ?? []} onChange={roles => updateRoles(i, roles)} />
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {['DEPLOY_IIS_WEBSITE', 'DEPLOY_IIS_WEBAPP', 'RUN_POWERSHELL_SCRIPT', 'RUN_PACKAGE_SCRIPT'].map(type => (
          <button key={type} className="btn btn-green"
            onClick={() => setLocalSteps(s => [...s, { id: '', projectId: id!, position: s.length, type, configJson: '{}', targetRoles: [] }])}>
            + {type}
          </button>
        ))}
        <button className="btn btn-green" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : 'Save Steps'}
        </button>
      </div>
    </div>
  )
}
