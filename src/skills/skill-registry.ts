import { readFile, readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { parse } from "yaml"
import { agentRoles } from "../core/roles.js"
import { objectiveTokens } from "../core/text.js"

export interface SkillMetadata {
  id: string
  name: string
  description: string
  estimatedContextTokens?: number
  compatibleAgents?: string[]
}

export type SkillLoader = () => Promise<unknown>

export class SkillRegistry {
  private readonly skills = new Map<string, { metadata: SkillMetadata; load: SkillLoader }>()
  private readonly loaded = new Map<string, Promise<unknown>>()

  register(metadata: SkillMetadata, load: SkillLoader): void {
    if (this.skills.has(metadata.id)) throw new Error(`skill already registered: ${metadata.id}`)
    this.skills.set(metadata.id, { metadata: { ...metadata }, load })
  }

  async loadFrom(directory: string): Promise<void> {
    let entries
    try { entries = await readdir(directory, { withFileTypes: true }) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return
      throw error
    }
    for (const entry of entries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      const manifestPath = join(directory, entry.name, "manifest.yaml")
      let raw: string
      try { raw = await readFile(manifestPath, "utf8") } catch (error) {
        throw new Error(`invalid Warden skill at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`)
      }
      const metadata = parseManifest(manifestPath, parse(raw))
      const contentPath = join(directory, entry.name, "SKILL.md")
      try {
        if (!(await stat(contentPath)).isFile()) throw new Error("not a file")
      } catch {
        throw new Error(`invalid Warden skill at ${manifestPath}: missing SKILL.md`)
      }
      this.register(metadata, () => readFile(contentPath, "utf8"))
    }
  }

  list(): SkillMetadata[] {
    return [...this.skills.values()].map(({ metadata }) => ({ ...metadata }))
  }

  async load(id: string): Promise<unknown> {
    const skill = this.skills.get(id)
    if (!skill) throw new Error(`unknown skill: ${id}`)
    let loaded = this.loaded.get(id)
    if (!loaded) {
      loaded = skill.load().catch((error) => {
        this.loaded.delete(id)
        throw error
      })
      this.loaded.set(id, loaded)
    }
    return loaded
  }
}

export function detectSkills(skills: readonly SkillMetadata[], objective: string, agent?: string): SkillMetadata[] {
  const tokens = objectiveTokens(objective)
  return skills.filter((skill) =>
    (agent === undefined || skill.compatibleAgents === undefined || skill.compatibleAgents.includes(agent)) &&
    tokens.some((token) => `${skill.name} ${skill.description}`.toLowerCase().includes(token))
  )
}

function parseManifest(path: string, value: unknown): SkillMetadata {
  if (!isRecord(value)) throw new Error(`invalid Warden skill at ${path}: expected an object`)
  if (typeof value.name !== "string" || value.name.length === 0) throw new Error(`invalid Warden skill at ${path}: invalid name`)
  if (value.description !== undefined && typeof value.description !== "string") throw new Error(`invalid Warden skill at ${path}: invalid description`)
  if (value.estimatedContextTokens !== undefined && !(typeof value.estimatedContextTokens === "number" && Number.isInteger(value.estimatedContextTokens) && value.estimatedContextTokens > 0)) throw new Error(`invalid Warden skill at ${path}: invalid estimatedContextTokens`)
  if (value.compatibleAgents !== undefined && !(Array.isArray(value.compatibleAgents) && value.compatibleAgents.every((agent) => typeof agent === "string" && agentRoles.includes(agent as typeof agentRoles[number])))) throw new Error(`invalid Warden skill at ${path}: invalid compatibleAgents`)
  return {
    id: value.name,
    name: value.name,
    description: value.description ?? "",
    ...(value.estimatedContextTokens !== undefined && { estimatedContextTokens: value.estimatedContextTokens }),
    ...(value.compatibleAgents !== undefined && { compatibleAgents: [...value.compatibleAgents as string[]] })
  }
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
