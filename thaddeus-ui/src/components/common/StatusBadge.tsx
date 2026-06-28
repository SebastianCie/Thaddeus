import type { DeploymentStatus, AgentStatus } from '../../types'

type Status = DeploymentStatus | AgentStatus | string

const classMap: Record<string, string> = {
  SUCCESS: 'badge-success',
  ONLINE: 'badge-online',
  FAILED: 'badge-error',
  RUNNING: 'badge-running',
  PENDING: 'badge-pending',
  CANCELLED: 'badge-cancelled',
  OFFLINE: 'badge-offline',
  DISABLED: 'badge-disabled',
}

const labelMap: Record<string, string> = {
  ONLINE: 'Healthy',
  OFFLINE: 'Unavailable',
  DISABLED: 'Disabled',
}

export function StatusBadge({ status }: { status: Status }) {
  const cls = classMap[status] ?? 'badge-pending'
  const label = labelMap[status] ?? status
  return <span className={`badge ${cls}`}>{label}</span>
}
