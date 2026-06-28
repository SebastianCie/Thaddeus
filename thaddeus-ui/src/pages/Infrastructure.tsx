import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi, environmentsApi } from '../api/client'
import { StatusBadge } from '../components/common/StatusBadge'
import type { Agent, Environment } from '../types'
import { formatDistanceToNow } from 'date-fns'

function AssignTargetsModal({ agent, environments, onClose }: {
  agent: Agent
  environments: Environment[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [selectedEnvIds, setSelectedEnvIds] = useState<Set<string>>(
    new Set(agent.agentEnvironments?.map(e => e.id) ?? [])
  )
  const [roles, setRoles] = useState<string[]>(
    agent.agentRoles?.map(r => r.name) ?? []
  )
  const [roleInput, setRoleInput] = useState('')

  const mutation = useMutation({
    mutationFn: () => agentsApi.assignTargets(agent.id, {
      environmentIds: Array.from(selectedEnvIds),
      roleNames: roles,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      onClose()
    },
  })

  function toggleEnv(id: string) {
    setSelectedEnvIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function addRole() {
    const name = roleInput.trim().toLowerCase()
    if (name && !roles.includes(name)) setRoles(r => [...r, name])
    setRoleInput('')
  }

  function removeRole(name: string) {
    setRoles(r => r.filter(x => x !== name))
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ minWidth: 420 }}>
        <div className="modal-title">Configure Deployment Target — {agent.hostname}</div>

        <div className="form-group">
          <label className="form-label">Environments</label>
          {environments.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No environments yet. Create one first.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {environments.map(env => (
                <label key={env.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={selectedEnvIds.has(env.id)}
                    onChange={() => toggleEnv(env.id)}
                  />
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: env.color, flexShrink: 0 }} />
                  {env.name}
                  {env.description && (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>— {env.description}</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Roles</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {roles.map(r => (
              <span key={r} style={{
                background: 'var(--color-surface-2, #2d2d2d)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                {r}
                <button
                  onClick={() => removeRole(r)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0, lineHeight: 1 }}
                >×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="form-input"
              placeholder="e.g. web-server"
              value={roleInput}
              onChange={e => setRoleInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRole() } }}
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary" onClick={addRole} disabled={!roleInput.trim()}>Add</button>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
        {mutation.isError && (
          <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>Failed to save targets.</p>
        )}
      </div>
    </div>
  )
}

export function Infrastructure() {
  const qc = useQueryClient()

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ['agents'], queryFn: agentsApi.list, refetchInterval: 15_000,
  })
  const { data: environments = [] } = useQuery<Environment[]>({
    queryKey: ['environments'], queryFn: environmentsApi.list,
  })

  const deleteAgentMutation = useMutation({
    mutationFn: (id: string) => agentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })

  const disableMutation = useMutation({
    mutationFn: (id: string) => agentsApi.disable(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })

  const enableMutation = useMutation({
    mutationFn: (id: string) => agentsApi.enable(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })

  const [configuringAgent, setConfiguringAgent] = useState<Agent | null>(null)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Deployment Targets</h1>
      </div>

      {agentsLoading ? <div className="loading">Loading…</div> : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Hostname</th>
                <th>IP</th>
                <th>OS</th>
                <th>Version</th>
                <th>Environments</th>
                <th>Roles</th>
                <th>Last Seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr><td colSpan={9}><div className="empty-state">No deployment targets registered.</div></td></tr>
              ) : agents.map(a => (
                <tr key={a.id}>
                  <td><StatusBadge status={a.status} /></td>
                  <td style={{ fontWeight: 500 }}>{a.hostname}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.ip}</td>
                  <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{a.osVersion}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.agentVersion}</td>
                  <td style={{ fontSize: 12 }}>
                    {a.agentEnvironments?.length
                      ? a.agentEnvironments.map(e => (
                        <span key={e.id} className="badge badge-pending" style={{ marginRight: 4 }}>{e.name}</span>
                      ))
                      : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {a.agentRoles?.length
                      ? a.agentRoles.map(r => (
                        <span key={r.id} className="badge badge-pending" style={{ marginRight: 4, background: 'var(--color-surface-2, #2d2d2d)' }}>{r.name}</span>
                      ))
                      : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {formatDistanceToNow(new Date(a.lastSeenAt), { addSuffix: true })}
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => setConfiguringAgent(a)}>
                      Configure
                    </button>
                    {a.status === 'DISABLED' ? (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => enableMutation.mutate(a.id)}
                        disabled={enableMutation.isPending}
                      >
                        Enable
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => disableMutation.mutate(a.id)}
                        disabled={disableMutation.isPending}
                      >
                        Disable
                      </button>
                    )}
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => { if (confirm(`Deployment Target "${a.hostname}" löschen?`)) deleteAgentMutation.mutate(a.id) }}
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

      {configuringAgent && (
        <AssignTargetsModal
          agent={configuringAgent}
          environments={environments}
          onClose={() => setConfiguringAgent(null)}
        />
      )}
    </div>
  )
}
