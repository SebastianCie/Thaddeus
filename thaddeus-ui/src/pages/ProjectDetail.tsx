import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi, releasesApi, environmentsApi, packagesApi } from '../api/client'
import type { Project, DeploymentStep, Variable, Release, Environment, Package } from '../types'

type Tab = 'steps' | 'variables' | 'releases'

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('steps')

  const { data: project } = useQuery<Project>({ queryKey: ['project', id], queryFn: () => projectsApi.get(id!), enabled: !!id })
  const { data: steps = [] } = useQuery<DeploymentStep[]>({ queryKey: ['steps', id], queryFn: () => projectsApi.getSteps(id!), enabled: !!id })
  const { data: variables = [] } = useQuery<Variable[]>({ queryKey: ['variables', id], queryFn: () => projectsApi.getVariables(id!), enabled: !!id })
  const { data: releases = [] } = useQuery<Release[]>({ queryKey: ['releases', id], queryFn: () => releasesApi.list(id!), enabled: !!id })
  const { data: environments = [] } = useQuery<Environment[]>({ queryKey: ['environments'], queryFn: environmentsApi.list })

  // Create release modal state
  const [showRelease, setShowRelease] = useState(false)
  const [releaseForm, setReleaseForm] = useState({ packageVersion: '' })

  const createReleaseMutation = useMutation({
    mutationFn: () => releasesApi.create(id!, releaseForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['releases', id] }); setShowRelease(false) },
  })

  if (!project) return <div className="loading">Loading…</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{project.name}</h1>
        <button className="btn btn-primary" onClick={() => setShowRelease(true)}>+ Create Release</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
        {(['steps', 'variables', 'releases'] as Tab[]).map(t => (
          <button
            key={t}
            className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t)}
            style={{ textTransform: 'capitalize' }}
          >{t}</button>
        ))}
      </div>

      {tab === 'steps' && <StepsTab projectId={id!} steps={steps} qc={qc} />}
      {tab === 'variables' && <VariablesTab projectId={id!} variables={variables} environments={environments} qc={qc} />}
      {tab === 'releases' && <ReleasesTab releases={releases} environments={environments} projectId={id!} />}

      {showRelease && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Create Release for {project.name}</div>
            <div className="form-group">
              <label className="form-label">Package Version *</label>
              <input className="form-input" placeholder="e.g. 1.2.3" value={releaseForm.packageVersion}
                onChange={e => setReleaseForm(f => ({ ...f, packageVersion: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowRelease(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => createReleaseMutation.mutate()}
                disabled={!releaseForm.packageVersion || createReleaseMutation.isPending}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StepsTab({ projectId, steps, qc }: { projectId: string; steps: DeploymentStep[]; qc: any }) {
  const [localSteps, setLocalSteps] = useState(steps)
  const saveMutation = useMutation({
    mutationFn: () => projectsApi.replaceSteps(projectId, localSteps.map((s, i) => ({ type: s.type, configJson: s.configJson }))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steps', projectId] }),
  })

  return (
    <div>
      {localSteps.map((step, i) => (
        <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--color-text-muted)', minWidth: 24 }}>{i}</span>
          <span className="badge badge-pending" style={{ fontFamily: 'monospace' }}>{step.type}</span>
          <span style={{ color: 'var(--color-text-muted)', flex: 1, fontSize: 12, fontFamily: 'monospace' }}>
            {step.configJson}
          </span>
          <button className="btn btn-sm btn-danger" onClick={() => setLocalSteps(s => s.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {['DEPLOY_IIS_WEBSITE', 'DEPLOY_IIS_WEBAPP', 'RUN_POWERSHELL_SCRIPT'].map(type => (
          <button key={type} className="btn btn-secondary btn-sm"
            onClick={() => setLocalSteps(s => [...s, { id: '', projectId, position: s.length, type, configJson: '{}' }])}>
            + {type}
          </button>
        ))}
        <button className="btn btn-primary btn-sm" onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}>Save Steps</button>
      </div>
    </div>
  )
}

function VariablesTab({ projectId, variables, environments, qc }: { projectId: string; variables: Variable[]; environments: Environment[]; qc: any }) {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', value: '', isSecret: false, environmentId: '' })

  const createMutation = useMutation({
    mutationFn: () => projectsApi.createVariable(projectId, { ...form, environmentId: form.environmentId || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['variables', projectId] }); setShowModal(false) },
  })
  const deleteMutation = useMutation({
    mutationFn: (varId: string) => projectsApi.deleteVariable(projectId, varId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['variables', projectId] }),
  })

  const envName = (id: string | null) => environments.find(e => e.id === id)?.name ?? 'All Environments'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Add Variable</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Name</th><th>Value</th><th>Environment</th><th></th></tr></thead>
          <tbody>
            {variables.map(v => (
              <tr key={v.id}>
                <td style={{ fontFamily: 'monospace' }}>{v.name}</td>
                <td style={{ fontFamily: 'monospace', color: v.isSecret ? 'var(--color-text-muted)' : undefined }}>{v.value}</td>
                <td style={{ fontSize: 12 }}>{envName(v.environmentId)}</td>
                <td><button className="btn btn-sm btn-danger" onClick={() => deleteMutation.mutate(v.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Add Variable</div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Value</label>
              <input className="form-input" type={form.isSecret ? 'password' : 'text'} value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isSecret} onChange={e => setForm(f => ({ ...f, isSecret: e.target.checked }))} />
                Secret (encrypted, masked in logs)
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">Environment Scope</label>
              <select className="form-select" value={form.environmentId} onChange={e => setForm(f => ({ ...f, environmentId: e.target.value }))}>
                <option value="">All Environments (default)</option>
                {environments.map(env => <option key={env.id} value={env.id}>{env.name}</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReleasesTab({ releases, environments, projectId }: { releases: Release[]; environments: Environment[]; projectId: string }) {
  const [deployModal, setDeployModal] = useState<Release | null>(null)
  const [envId, setEnvId] = useState('')

  const deployMutation = useMutation({
    mutationFn: () => import('../api/client').then(m => m.deploymentsApi.trigger(deployModal!.id, envId)),
    onSuccess: () => setDeployModal(null),
  })

  return (
    <div>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Version</th><th>Package Version</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {releases.map(r => (
              <tr key={r.id}>
                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.version}</td>
                <td style={{ fontFamily: 'monospace' }}>{r.packageVersion}</td>
                <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{new Date(r.createdAt).toLocaleString()}</td>
                <td>
                  <button className="btn btn-sm btn-primary" onClick={() => { setDeployModal(r); setEnvId(environments[0]?.id ?? '') }}>
                    Deploy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deployModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Deploy Release {deployModal.version}</div>
            <div className="form-group">
              <label className="form-label">Environment</label>
              <select className="form-select" value={envId} onChange={e => setEnvId(e.target.value)}>
                {environments.map(env => <option key={env.id} value={env.id}>{env.name}</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeployModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => deployMutation.mutate()} disabled={!envId || deployMutation.isPending}>
                Trigger Deployment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
