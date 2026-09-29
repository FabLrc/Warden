import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { emptyPriceBook, fetchOpenRouterQuota, formatQuota, loadPriceBook, priceCachePath } from "../../src/models/pricing.js"

const catalog = {
  anthropic: {
    models: {
      "claude-haiku-4-5": { cost: { input: 1, output: 5, cache_read: 0.1, cache_write: 1.25 } }
    }
  },
  openrouter: {
    models: {
      "anthropic/claude-haiku-4.5": { cost: { input: 1.1, output: 5.5 } },
      "free/model": {}
    }
  }
}

function jsonResponse(value: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => value } as Response
}

describe("loadPriceBook", () => {
  it("fetches models.dev once, caches prices, and estimates usage cost", async () => {
    const home = await mkdtemp(join(tmpdir(), "warden-prices-"))
    const fetchImpl = async () => jsonResponse(catalog)

    const book = await loadPriceBook({ home, fetchImpl, now: 1_000 })
    expect(book.priceFor("anthropic", "claude-haiku-4-5")).toEqual({ input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 })
    expect(book.estimate("anthropic", "claude-haiku-4-5", { input: 1_000_000, output: 100_000, cachedInput: 2_000_000, cachedWrite: 500_000 })).toBeCloseTo(1 + 0.5 + 0.2 + 0.625)
    expect(book.estimate("anthropic", "unknown-model", {})).toBeUndefined()

    let calls = 0
    const fresh = await loadPriceBook({ home, fetchImpl: async () => { calls++; return jsonResponse(catalog) }, now: 2_000 })
    expect(calls).toBe(0)
    expect(fresh.priceFor("anthropic", "claude-haiku-4-5")?.output).toBe(5)
  })

  it("falls back to a stale cache when the refresh fails", async () => {
    const home = await mkdtemp(join(tmpdir(), "warden-prices-"))
    await mkdir(join(home, ".warden", "cache"), { recursive: true })
    await writeFile(priceCachePath(home), JSON.stringify({ fetchedAt: 1_000, prices: { "anthropic/claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0, cacheWrite: 0 } } }))

    const book = await loadPriceBook({ home, fetchImpl: async () => jsonResponse({}, false, 500), now: 1_000 + 25 * 60 * 60 * 1000 })
    expect(book.priceFor("anthropic", "claude-haiku-4-5")?.input).toBe(1)
  })

  it("returns an empty book when offline with no cache", async () => {
    const home = await mkdtemp(join(tmpdir(), "warden-prices-"))
    const book = await loadPriceBook({ home, fetchImpl: async () => { throw new Error("offline") }, now: 1_000 })
    expect(book.priceFor("anthropic", "claude-haiku-4-5")).toBeUndefined()
    expect(emptyPriceBook().estimate("a", "b", { input: 1 })).toBeUndefined()
  })

  it("resolves openrouter-prefixed model ids across providers", async () => {
    const home = await mkdtemp(join(tmpdir(), "warden-prices-"))
    const book = await loadPriceBook({ home, fetchImpl: async () => jsonResponse(catalog), now: 1_000 })
    expect(book.priceFor("openrouter", "anthropic/claude-haiku-4.5")?.input).toBe(1.1)
    expect(book.estimate("openrouter", "anthropic/claude-haiku-4.5", { input: 1_000_000 })).toBeCloseTo(1.1)
    expect(book.priceFor("openrouter", "free/model")).toBeUndefined()
  })
})

describe("fetchOpenRouterQuota", () => {
  it("combines plan usage and remaining credits into one quota", async () => {
    const fetchImpl = async (url: string | URL | Request) => {
      const target = String(url)
      if (target.endsWith("/key")) return jsonResponse({ data: { usage: 25, limit: 100 } })
      if (target.endsWith("/credits")) return jsonResponse({ total_credits: 120, total_usage: 45.5 })
      throw new Error(`unexpected fetch: ${target}`)
    }
    const quota = await fetchOpenRouterQuota({ apiKey: "k", fetchImpl })
    expect(quota).toEqual({ planUsed: 25, planLimit: 100, planPercentUsed: 25, creditsRemaining: 74.5 })
    expect(formatQuota(quota)).toBe("quota: openrouter 25% of plan, $74.50 remaining")
  })

  it("tolerates unlimited plans and unreadable credits", async () => {
    const fetchImpl = async (url: string | URL | Request) => String(url).endsWith("/key")
      ? jsonResponse({ data: { usage: 2, limit: null } })
      : jsonResponse({}, false, 500)
    await expect(fetchOpenRouterQuota({ apiKey: "k", fetchImpl })).resolves.toEqual({ planUsed: 2 })
  })

  it("fails when the key endpoint rejects", async () => {
    await expect(fetchOpenRouterQuota({ apiKey: "k", fetchImpl: async () => jsonResponse({}, false, 401) })).rejects.toThrow("openrouter key returned 401")
  })
})
