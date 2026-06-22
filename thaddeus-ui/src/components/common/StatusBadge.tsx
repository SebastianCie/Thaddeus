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
}

export function StatusBadge({ status }: { status: Status }) {
  const cls = classMap[status] ?? 'badge-pending'
  return <span className={`badge ${cls}`}>{status}</span>
}
