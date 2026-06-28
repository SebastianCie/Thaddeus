import { useQuery } from '@tanstack/react-query'
import { agentsApi, environmentsApi } from '../api/client'
import type { Agent, Environment } from '../types'

export function InfrastructureDashboard() {
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents'], queryFn: agentsApi.list, refetchInterval: 15_000,
  })
  const { data: environments = [] } = useQuery<Environment[]>({
    queryKey: ['environments'], queryFn: environmentsApi.list,
  })

  const online = agents.filter(a => a.status === 'ONLINE').length
  const offline = agents.filter(a => a.status === 'OFFLINE').length
  const disabled = agents.filter(a => a.status === 'DISABLED').length

  const targetsPerEnv = new Map<string, number>()
  agents.forEach(agent => {
    agent.agentEnvironments?.forEach(env => {
      targetsPerEnv.set(env.id, (targetsPerEnv.get(env.id) ?? 0) + 1)
    })
  })

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Infrastructure Overview</h1>
      </div>

      <div className="infra-section">
        <div className="infra-section-title">
          Deployment Targets <span className="infra-section-count">({agents.length})</span>
        </div>
        <div className="infra-stat-row">
          <div className="infra-stat-card infra-stat-online">
            <div className="infra-stat-icon">✓</div>
            <div>
              <div className="infra-stat-value">{online}</div>
              <div className="infra-stat-label">Healthy</div>
            </div>
          </div>
          <div className="infra-stat-card infra-stat-offline">
            <div className="infra-stat-icon">✕</div>
            <div>
              <div className="infra-stat-value">{offline}</div>
              <div className="infra-stat-label">Unavailable</div>
            </div>
          </div>
          <div className="infra-stat-card infra-stat-disabled">
            <div className="infra-stat-icon">—</div>
            <div>
              <div className="infra-stat-value">{disabled}</div>
              <div className="infra-stat-label">Disabled</div>
            </div>
          </div>
        </div>
      </div>

      <div className="infra-section" style={{ marginTop: 24 }}>
        <div className="infra-section-title">
          Environments <span className="infra-section-count">({environments.length})</span>
        </div>
        <div className="card" style={{ padding: 0 }}>
          <table>
            <tbody>
              {environments.length === 0 ? (
                <tr><td><div className="empty-state">No environments configured.</div></td></tr>
              ) : environments.map((env: Environment) => {
                const targets = targetsPerEnv.get(env.id) ?? 0
                return (
                  <tr key={env.id}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: env.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 500 }}>{env.name}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`badge ${targets > 0 ? 'badge-success' : 'badge-pending'}`}>
                        {targets} {targets === 1 ? 'target' : 'targets'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
