export const agentRoles = ["warden", "inspector", "navigator", "builder", "reviewer"] as const

export type AgentRole = typeof agentRoles[number]

export interface RoleConstraints {
  read: true
  write: boolean
}

export const roleConstraints: Record<AgentRole, RoleConstraints> = {
  warden: { read: true, write: false },
  inspector: { read: true, write: false },
  navigator: { read: true, write: false },
  builder: { read: true, write: true },
  reviewer: { read: true, write: false }
}

export function canWrite(role: AgentRole): boolean {
  return roleConstraints[role].write
}
