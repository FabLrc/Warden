import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import type { Usage } from "../core/events.js"

export const priceCacheTtlMs = 24 * 60 * 60 * 1000

export interface ModelPrice {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export interface PriceBook {
  priceFor(provider: string, model: string): ModelPrice | undefined
  estimate(provider: string, model: string, usage: Usage): number | undefined
}

export interface OpenRouterQuota {
  planUsed?: number
  planLimit?: number
  planPercentUsed?: number
  creditsRemaining?: number
}

interface PriceCache { fetchedAt: number; prices: Record<string, ModelPrice> }

export function emptyPriceBook(): PriceBook {
  return { priceFor: () => undefined, estimate: () => undefined }
}

export async function loadPriceBook(options: { home?: string; fetchImpl?: typeof fetch; now?: number } = {}): Promise<PriceBook> {
  const home = options.home ?? homedir()
  const now = options.now ?? Date.now()
  const path = priceCachePath(home)
  const cached = await readCache(path)
  if (cached && now - cached.fetchedAt < priceCacheTtlMs) return book(cached.prices)
  try {
    const response = await (options.fetchImpl ?? fetch)("https://models.dev/api.json")
    if (!response.ok) throw new Error(`models.dev returned ${response.status}`)
    const prices = extractPrices(await response.json())
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify({ fetchedAt: now, prices } satisfies PriceCache))
    return book(prices)
  } catch {
    return cached ? book(cached.prices) : emptyPriceBook()
  }
}

export function priceCachePath(home: string): string {
  return join(home, ".warden", "cache", "models-dev.json")
}

export async function fetchOpenRouterQuota(options: { apiKey: string; fetchImpl?: typeof fetch }): Promise<OpenRouterQuota> {
  const fetchImpl = options.fetchImpl ?? fetch
  const headers = { Authorization: `Bearer ${options.apiKey}` }
  const [keyResponse, creditsResponse] = await Promise.all([
    fetchImpl("https://openrouter.ai/api/v1/key", { headers }),
    fetchImpl("https://openrouter.ai/api/v1/credits", { headers })
  ])
  if (!keyResponse.ok) throw new Error(`openrouter key returned ${keyResponse.status}`)
  const key = (await keyResponse.json()) as { data?: { usage?: number; limit?: number | null } }
  const quota: OpenRouterQuota = {}
  if (typeof key.data?.usage === "number") quota.planUsed = key.data.usage
  if (typeof key.data?.limit === "number" && key.data.limit > 0) {
    quota.planLimit = key.data.limit
    quota.planPercentUsed = (key.data.usage ?? 0) / key.data.limit * 100
  }
  if (creditsResponse.ok) {
    const credits = (await creditsResponse.json()) as { total_credits?: number; total_usage?: number }
    if (typeof credits.total_credits === "number" && typeof credits.total_usage === "number") quota.creditsRemaining = credits.total_credits - credits.total_usage
  }
  return quota
}

export function formatQuota(quota: OpenRouterQuota): string {
  const parts: string[] = []
  if (quota.planPercentUsed !== undefined) parts.push(`${quota.planPercentUsed.toFixed(0)}% of plan`)
  if (quota.creditsRemaining !== undefined) parts.push(`$${quota.creditsRemaining.toFixed(2)} remaining`)
  return `quota: openrouter ${parts.join(", ")}`
}

function book(prices: Record<string, ModelPrice>): PriceBook {
  const byModel = new Map<string, ModelPrice>()
  for (const [key, price] of Object.entries(prices)) {
    const model = key.slice(key.indexOf("/") + 1)
    if (!byModel.has(model)) byModel.set(model, price)
  }
  const priceFor = (provider: string, model: string): ModelPrice | undefined => prices[`${provider}/${model}`] ?? byModel.get(model)
  return {
    priceFor,
    estimate(provider, model, usage) {
      const price = priceFor(provider, model)
      if (!price) return undefined
      const usd = (usage.input ?? 0) * price.input
        + (usage.output ?? 0) * price.output
        + (usage.cachedInput ?? 0) * price.cacheRead
        + (usage.cachedWrite ?? 0) * price.cacheWrite
      return usd / 1_000_000
    }
  }
}

function extractPrices(catalog: unknown): Record<string, ModelPrice> {
  const prices: Record<string, ModelPrice> = {}
  if (!isRecord(catalog)) return prices
  for (const [providerId, provider] of Object.entries(catalog)) {
    const models = isRecord(provider) && isRecord(provider.models) ? provider.models : undefined
    if (!models) continue
    for (const [modelId, model] of Object.entries(models)) {
      const cost = isRecord(model) && isRecord(model.cost) ? model.cost : undefined
      if (!cost) continue
      prices[`${providerId}/${modelId}`] = { input: usd(cost.input), output: usd(cost.output), cacheRead: usd(cost.cache_read), cacheWrite: usd(cost.cache_write) }
    }
  }
  return prices
}

async function readCache(path: string): Promise<PriceCache | undefined> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as PriceCache
    return typeof value.fetchedAt === "number" && isRecord(value.prices) ? value : undefined
  } catch {
    return undefined
  }
}

function usd(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
