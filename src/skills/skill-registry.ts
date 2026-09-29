export interface SkillMetadata {
  id: string
  name: string
  description: string
}

export type SkillLoader = () => Promise<unknown>

export class SkillRegistry {
  private readonly skills = new Map<string, { metadata: SkillMetadata; load: SkillLoader }>()
  private readonly loaded = new Map<string, Promise<unknown>>()

  register(metadata: SkillMetadata, load: SkillLoader): void {
    if (this.skills.has(metadata.id)) throw new Error(`skill already registered: ${metadata.id}`)
    this.skills.set(metadata.id, { metadata: { ...metadata }, load })
  }

  list(): SkillMetadata[] {
    return [...this.skills.values()].map(({ metadata }) => ({ ...metadata }))
  }

  async load(id: string): Promise<unknown> {
    const skill = this.skills.get(id)
    if (!skill) throw new Error(`unknown skill: ${id}`)
    let loaded = this.loaded.get(id)
    if (!loaded) {
      loaded = skill.load()
      this.loaded.set(id, loaded)
    }
    return loaded
  }
}
