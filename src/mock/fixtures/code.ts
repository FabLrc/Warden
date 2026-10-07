import wardenApp from "@/app/App.tsx?raw";
import wardenAppShell from "@/app/AppShell.tsx?raw";
import wardenCss from "@/index.css?raw";
import wardenLinks from "@/lib/links.ts?raw";
import wardenMain from "@/main.tsx?raw";
import type { FileNode } from "@/mock/types";
import wardenTypes from "@/mock/types.ts?raw";
import wardenCdc from "../../../docs/cahier-des-charges.md?raw";
import wardenDecisions from "../../../docs/decisions.md?raw";
import wardenPlan from "../../../docs/specs/stage-0-prototype-ux.md?raw";
import wardenPackage from "../../../package.json?raw";
import wardenReadme from "../../../README.md?raw";
import wardenCargo from "../../../src-tauri/Cargo.toml?raw";
import wardenLib from "../../../src-tauri/src/lib.rs?raw";
import wardenRustMain from "../../../src-tauri/src/main.rs?raw";
import wardenTauriConf from "../../../src-tauri/tauri.conf.json?raw";

/**
 * Code workspace fixtures (CDC §28). Contents reflect each project's working tree *after* the sessions of
 * `sessions.ts`: e.g. `src/auth/refresh.ts` contains the fix of s-atlas-101, so the new side of its diffs in
 * `traces.ts` matches these lines. Deleted files (src/legacy/xml-export.ts) only exist in diffs.
 * The `warden` project is this repository: its files are bundled as-is with Vite `?raw` imports.
 */

// ── atlas-api ──────────────────────────────────────────────────────────────

const atlasApi: Record<string, string> = {
  "package.json": `{
  "name": "atlas-api",
  "version": "2.14.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "biome check ."
  },
  "dependencies": {
    "fastify": "^5.2.0",
    "postgres": "^3.4.5",
    "stripe": "^17.5.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "date-fns": "^4.1.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^3.0.0"
  }
}
`,
  "tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "skipLibCheck": true
  },
  "include": ["src"]
}
`,
  "README.md": `# atlas-api

API Node/TypeScript d'authentification et de facturation.

## Démarrer

\`\`\`sh
cp .env.example .env
npm install
npm run dev
\`\`\`

## Modules

- \`src/auth\` — access tokens (JWT, 15 min) et refresh tokens opaques (7 jours, usage unique) ;
- \`src/billing\` — factures et calcul de TVA ;
- \`src/webhooks\` — webhooks Stripe.

## Tests

\`npm test\` lance Vitest. Les tests d'intégration utilisent la base \`atlas_test\`.
`,
  "db/migrations/0012_refresh_tokens.sql": `create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index refresh_tokens_user_id_idx on refresh_tokens (user_id);
`,
  "src/server.ts": `import Fastify from "fastify";
import { registerAuthRoutes } from "./auth/session";
import { env } from "./config/env";
import { registerStripeWebhook } from "./webhooks/stripe";

const app = Fastify({ logger: env.NODE_ENV !== "test" });

registerAuthRoutes(app);
registerStripeWebhook(app);

app.get("/health", async () => ({ ok: true }));

await app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
`,
  "src/config/env.ts": `import { z } from "zod";

const num = (fallback: number) => z.coerce.number().int().positive().default(fallback);

/**
 * Process configuration, validated once at boot.
 * Durations are in seconds.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  ACCESS_TOKEN_TTL: num(900),
  REFRESH_TOKEN_TTL: num(604800),
  JWT_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  DEFAULT_VAT_RATE: z.coerce.number().min(0).max(1).default(0.2),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);
`,
  "src/db/index.ts": `import postgres from "postgres";
import type { Invoice } from "../billing/invoice";
import { env } from "../config/env";

export const sql = postgres(env.DATABASE_URL, { max: 10 });

interface RefreshTokenRow {
  id: string;
  userId: string;
  hash: string;
  expiresAt: Date;
}

export const db = {
  refreshTokens: {
    insert: (row: Omit<RefreshTokenRow, "id">) => sql\`insert into refresh_tokens \${sql(row)}\`,
    findByHash: async (hash: string): Promise<RefreshTokenRow | undefined> =>
      (await sql<RefreshTokenRow[]>\`select * from refresh_tokens where hash = \${hash}\`)[0],
    delete: (id: string) => sql\`delete from refresh_tokens where id = \${id}\`,
    deleteByUser: async (userId: string) =>
      (await sql\`delete from refresh_tokens where user_id = \${userId}\`).count,
    all: () => sql<RefreshTokenRow[]>\`select * from refresh_tokens\`,
    truncate: () => sql\`truncate refresh_tokens\`,
  },
  customers: {
    get: async (id: string) =>
      (await sql<{ id: string; country: string; vatId?: string }[]>\`select * from customers where id = \${id}\`)[0],
  },
  invoices: {
    insert: (invoice: Invoice) => sql\`insert into invoices \${sql({ ...invoice, tax: sql.json(invoice.tax) })}\`,
  },
};
`,
  "src/lib/hash.ts": `import { createHash } from "node:crypto";

export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
`,
  "src/users/types.ts": `export type Role = "member" | "admin";

export interface User {
  id: string;
  email: string;
  role: Role;
}
`,
  "src/users/repository.ts": `import { sql } from "../db";
import type { User } from "./types";

export async function findUserByCredentials(email: string, password: string): Promise<User | undefined> {
  const [row] = await sql<(User & { passwordHash: string })[]>\`
    select id, email, role, password_hash as "passwordHash"
    from users where email = \${email.toLowerCase()}
  \`;
  if (!row || !(await Bun.password.verify(password, row.passwordHash))) return undefined;
  return { id: row.id, email: row.email, role: row.role };
}
`,
  "src/auth/types.ts": `export interface RefreshToken {
  /** Opaque value returned to the client once; never stored. */
  value: string;
  userId: string;
  expiresAt: Date;
}

export interface AccessClaims {
  sub: string;
  role: string;
  iat: number;
  exp: number;
}
`,
  "src/auth/errors.ts": `export class InvalidTokenError extends Error {
  readonly status = 401;
  constructor() {
    super("invalid token");
  }
}

export class TokenExpiredError extends Error {
  readonly status = 401;
  constructor() {
    super("refresh token expired");
  }
}
`,
  "src/auth/access.ts": `import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";
import type { User } from "../users/types";
import { InvalidTokenError, TokenExpiredError } from "./errors";
import type { AccessClaims } from "./types";

const claims = (user: User, now: number): AccessClaims => ({
  sub: user.id,
  exp: now + env.ACCESS_TOKEN_TTL,
  role: user.role,
  iat: now,
});

const sign = (payload: string) => createHmac("sha256", env.JWT_SECRET).update(payload).digest("base64url");

export function signAccessToken(user: User): string {
  const payload = Buffer.from(JSON.stringify(claims(user, Math.floor(Date.now() / 1000)))).toString("base64url");
  return payload + "." + sign(payload);
}

export function verifyAccessToken(token: string): AccessClaims {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new InvalidTokenError();
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) throw new InvalidTokenError();
  const decoded: AccessClaims = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (decoded.exp <= Math.floor(Date.now() / 1000)) throw new TokenExpiredError();
  return decoded;
}
`,
  "src/auth/refresh.ts": `import { randomBytes } from "node:crypto";
import { db } from "../db";
import { sha256 } from "../lib/hash";
import type { User } from "../users/types";
import { InvalidTokenError, TokenExpiredError } from "./errors";
import type { RefreshToken } from "./types";
import { env } from "../config/env";

/**
 * Refresh tokens are opaque random strings; only their SHA-256 hash is stored.
 *
 * - single use: every rotation deletes the presented token and issues a new one;
 * - lifetime: \`env.REFRESH_TOKEN_TTL\` seconds (7 days by default);
 * - an unknown token raises InvalidTokenError, an expired one TokenExpiredError
 *   (the session layer maps both to HTTP 401, see ./session.ts).
 */

export async function issueRefreshToken(user: User): Promise<RefreshToken> {
  const value = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000);
  await db.refreshTokens.insert({ userId: user.id, hash: sha256(value), expiresAt });
  return { value, userId: user.id, expiresAt };
}

export async function rotateRefreshToken(value: string): Promise<RefreshToken> {
  const stored = await db.refreshTokens.findByHash(sha256(value));
  if (!stored) {
    throw new InvalidTokenError();
  }
  if (stored.expiresAt.getTime() <= Date.now()) {
    await db.refreshTokens.delete(stored.id);
    throw new TokenExpiredError();
  }
  await db.refreshTokens.delete(stored.id);
  return issueRefreshToken({ id: stored.userId });
}

/** Logout everywhere: drops every refresh token of the user. */
export async function revokeAllRefreshTokens(userId: string): Promise<number> {
  return db.refreshTokens.deleteByUser(userId);
}
`,
  "src/auth/session.ts": `import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { findUserByCredentials } from "../users/repository";
import { signAccessToken, verifyAccessToken } from "./access";
import { InvalidTokenError, TokenExpiredError } from "./errors";
import { issueRefreshToken, revokeAllRefreshTokens, rotateRefreshToken } from "./refresh";

const credentials = z.object({ email: z.string().email(), password: z.string().min(1) });
const refreshBody = z.object({ refreshToken: z.string().min(1) });

export function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (req, reply) => {
    const { email, password } = credentials.parse(req.body);
    const user = await findUserByCredentials(email, password);
    if (!user) return reply.code(401).send({ error: "invalid_credentials" });
    const refresh = await issueRefreshToken(user);
    return { accessToken: signAccessToken(user), refreshToken: refresh.value, expiresAt: refresh.expiresAt };
  });

  app.post("/auth/refresh", async (req, reply) => {
    const { refreshToken } = refreshBody.parse(req.body);
    try {
      const next = await rotateRefreshToken(refreshToken);
      return { accessToken: signAccessToken({ id: next.userId, email: "", role: "member" }), refreshToken: next.value };
    } catch (err) {
      if (err instanceof InvalidTokenError || err instanceof TokenExpiredError) {
        return reply.code(401).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post("/auth/logout-all", async (req) => {
    const claims = verifyAccessToken(String(req.headers.authorization ?? "").replace(/^Bearer /, ""));
    return { revoked: await revokeAllRefreshTokens(claims.sub) };
  });
}
`,
  "src/auth/__tests__/access.test.ts": `import { describe, expect, it, vi } from "vitest";
import { signAccessToken, verifyAccessToken } from "../access";
import { InvalidTokenError, TokenExpiredError } from "../errors";

const user = { id: "usr_42", email: "ada@example.com", role: "member" as const };

describe("access tokens", () => {
  it("round-trips the claims", () => {
    expect(verifyAccessToken(signAccessToken(user)).sub).toBe(user.id);
  });

  it("rejects a tampered token", () => {
    const token = signAccessToken(user);
    expect(() => verifyAccessToken(token.slice(0, -2) + "xx")).toThrow(InvalidTokenError);
  });

  it("expires after ACCESS_TOKEN_TTL", () => {
    vi.useFakeTimers();
    const token = signAccessToken(user);
    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(() => verifyAccessToken(token)).toThrow(TokenExpiredError);
    vi.useRealTimers();
  });
});
`,
  "src/auth/__tests__/refresh.test.ts": `import { addDays, addMinutes } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import type { User } from "../../users/types";
import { InvalidTokenError, TokenExpiredError } from "../errors";
import { issueRefreshToken, revokeAllRefreshTokens, rotateRefreshToken } from "../refresh";

const user: User = { id: "usr_42", email: "ada@example.com", role: "member" };

describe("refresh tokens", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await db.refreshTokens.truncate();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores only the hash of the token", async () => {
    const token = await issueRefreshToken(user);
    const rows = await db.refreshTokens.all();
    expect(rows).toHaveLength(1);
    expect(rows[0].hash).not.toBe(token.value);
  });

  it("is single use", async () => {
    const token = await issueRefreshToken(user);
    const next = await rotateRefreshToken(token.value);
    expect(next.value).not.toBe(token.value);
    await expect(rotateRefreshToken(token.value)).rejects.toThrow(InvalidTokenError);
  });

  it("rejects an unknown token", async () => {
    await expect(rotateRefreshToken("not-a-token")).rejects.toThrow(InvalidTokenError);
  });

  it("revokes every token of a user", async () => {
    await issueRefreshToken(user);
    await issueRefreshToken(user);
    await expect(revokeAllRefreshTokens(user.id)).resolves.toBe(2);
  });

  it("keeps the user id across rotations", async () => {
    const first = await issueRefreshToken(user);
    const token = await rotateRefreshToken(first.value);
    expect(token.value).not.toBe(first.value);
    expect(token.userId).toBe(user.id);
  });

  it("expires after REFRESH_TOKEN_TTL, not ACCESS_TOKEN_TTL", async () => {
    const now = new Date("2026-10-07T12:00:00Z");
    vi.setSystemTime(now);
    const token = await issueRefreshToken(user);

    vi.setSystemTime(addMinutes(now, 16));
    await expect(rotateRefreshToken(token.value)).resolves.toBeDefined();

    vi.setSystemTime(addDays(now, 8));
    await expect(rotateRefreshToken(token.value)).rejects.toThrow(TokenExpiredError);
  });
});
`,
  "src/auth/__tests__/session.test.ts": `import Fastify from "fastify";
import { beforeAll, describe, expect, it } from "vitest";
import { registerAuthRoutes } from "../session";

const app = Fastify();
registerAuthRoutes(app);

describe("auth routes", () => {
  beforeAll(() => app.ready());

  it("rejects bad credentials with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ada@example.com", password: "wrong" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("maps an unknown refresh token to 401", async () => {
    const res = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken: "nope" } });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "invalid token" });
  });
});
`,
  "src/billing/invoice.ts": `import { db } from "../db";
import { computeTax, type TaxBreakdown } from "./tax";

export interface InvoiceLine {
  description: string;
  quantity: number;
  /** Unit price excluding tax, in cents. */
  unitPrice: number;
  /** Overrides the customer's default VAT rate (e.g. reduced rate). */
  vatRate?: number;
}

export interface Invoice {
  id: string;
  customerId: string;
  country: string;
  lines: InvoiceLine[];
  subtotal: number;
  tax: TaxBreakdown;
  total: number;
  issuedAt: Date;
}

export async function createInvoice(customerId: string, lines: InvoiceLine[]): Promise<Invoice> {
  if (lines.length === 0) throw new Error("An invoice needs at least one line");
  const customer = await db.customers.get(customerId);
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const tax = computeTax(lines, { country: customer.country, vatId: customer.vatId });
  const invoice: Invoice = {
    id: crypto.randomUUID(),
    customerId,
    country: customer.country,
    lines,
    subtotal,
    tax,
    total: subtotal + tax.total,
    issuedAt: new Date(),
  };
  await db.invoices.insert(invoice);
  return invoice;
}

export function formatAmount(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);
}
`,
  "src/billing/tax.ts": `import { env } from "../config/env";
import type { InvoiceLine } from "./invoice";

export interface TaxContext {
  country: string;
  /** Intra-EU VAT number; enables reverse charge for B2B customers outside France. */
  vatId?: string;
}

export interface TaxBreakdown {
  /** Tax per rate, in cents. */
  byRate: { rate: number; base: number; amount: number }[];
  total: number;
  reverseCharge: boolean;
}

const EU_COUNTRIES = new Set(["AT", "BE", "DE", "ES", "FR", "IT", "LU", "NL", "PT"]);

export function isReverseCharge({ country, vatId }: TaxContext): boolean {
  return country !== "FR" && EU_COUNTRIES.has(country) && Boolean(vatId);
}

export function computeTax(lines: InvoiceLine[], ctx: TaxContext): TaxBreakdown {
  if (isReverseCharge(ctx)) return { byRate: [], total: 0, reverseCharge: true };
  const bases = new Map<number, number>();
  for (const line of lines) {
    const rate = line.vatRate ?? env.DEFAULT_VAT_RATE;
    bases.set(rate, (bases.get(rate) ?? 0) + line.quantity * line.unitPrice);
  }
  const byRate = [...bases].map(([rate, base]) => ({ rate, base, amount: Math.round(base * rate) }));
  return { byRate, total: byRate.reduce((sum, r) => sum + r.amount, 0), reverseCharge: false };
}
`,
  "src/webhooks/stripe.ts": `import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { env } from "../config/env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export function registerStripeWebhook(app: FastifyInstance) {
  app.post("/webhooks/stripe", { config: { rawBody: true } }, async (req, reply) => {
    const signature = String(req.headers["stripe-signature"] ?? "");
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(String(req.rawBody), signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return reply.code(400).send({ error: "bad_signature" });
    }
    if (event.type === "invoice.paid") {
      req.log.info({ invoice: event.data.object.id }, "invoice paid");
    }
    return { received: true };
  });
}
`,
};

// ── lumen-web ──────────────────────────────────────────────────────────────

const lumenWeb: Record<string, string> = {
  "package.json": `{
  "name": "lumen-web",
  "version": "0.38.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "storybook": "storybook dev -p 6006",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@storybook/react-vite": "^9.1.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "^5.9.0",
    "vite": "^7.1.0",
    "vitest": "^3.2.0"
  }
}
`,
  "README.md": `# lumen-web

Front React du dashboard client (clients, factures, usage).

- \`npm run dev\` — serveur de développement Vite ;
- \`npm run storybook\` — catalogue des composants.

Pas de bibliothèque de composants externe : les composants de \`src/components\` sont maison.
`,
  "vite.config.ts": `import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
`,
  "src/main.tsx": `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/theme.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
  "src/App.tsx": `import { useState } from "react";
import { Button } from "./components/Button";
import { Customers } from "./pages/Customers";

export function App() {
  const [dark, setDark] = useState(true);
  return (
    <div className={dark ? "app theme-dark" : "app"}>
      <header className="app-header">
        <h1>Lumen</h1>
        <Button variant="ghost" onClick={() => setDark((d) => !d)}>
          {dark ? "Thème clair" : "Thème sombre"}
        </Button>
      </header>
      <main>
        <Customers />
      </main>
    </div>
  );
}
`,
  "src/pages/Customers.tsx": `import { type Column, DataGrid } from "../components/DataGrid";

interface Customer {
  id: string;
  name: string;
  country: string;
  mrr: number;
}

const customers: Customer[] = [
  { id: "c1", name: "Acme", country: "FR", mrr: 4200 },
  { id: "c2", name: "Globex", country: "DE", mrr: 1800 },
  { id: "c3", name: "Initech", country: "BE", mrr: 960 },
];

const columns: Column<Customer>[] = [
  { key: "name", header: "Client", render: (c) => c.name, sortValue: (c) => c.name },
  { key: "country", header: "Pays", width: 80, render: (c) => c.country },
  { key: "mrr", header: "MRR", width: 120, render: (c) => c.mrr + " €", sortValue: (c) => c.mrr },
];

export function Customers() {
  return <DataGrid columns={columns} rows={customers} />;
}
`,
  "src/components/Button.tsx": `import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button type="button" className={["btn", "btn-" + variant, className].filter(Boolean).join(" ")} {...props} />;
}
`,
  "src/components/Button.stories.tsx": `import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  component: Button,
  args: { children: "Enregistrer" },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Disabled: Story = { args: { disabled: true } };
`,
  "src/components/DataGrid.tsx": `import { type ReactNode, useMemo, useState } from "react";
import { useColumns } from "../hooks/useColumns";
import { type SortState, sortRows } from "../hooks/useSort";
import "./DataGrid.css";

export interface Column<T> {
  key: string;
  header: string;
  /** Initial width in px (default 160). */
  width?: number;
  render: (row: T) => ReactNode;
  /** Makes the column sortable. */
  sortValue?: (row: T) => string | number;
}

export interface DataGridProps<T> {
  columns: Column<T>[];
  rows: T[];
}

/**
 * Read-only grid used by the Customers and Invoices pages.
 * Sorting is local; pagination is handled by the caller.
 */
export function DataGrid<T>({ columns, rows }: DataGridProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null);
  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sort?.key);
    return sort && column?.sortValue ? sortRows(rows, column.sortValue, sort.direction) : rows;
  }, [columns, rows, sort]);

  const toggleSort = (key: string) =>
    setSort((s) =>
      s?.key !== key ? { key, direction: "asc" } : s.direction === "asc" ? { key, direction: "desc" } : null,
    );
  const ariaSort = (key: string) =>
    sort?.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : undefined;

  // Column widths are user-resizable, never below 80 px.
  const { widths, resize } = useColumns(columns.map((c) => c.width ?? 160));
  return (
    <table className="grid" style={{ tableLayout: "fixed" }}>
      <colgroup>
        {widths.map((w, i) => (
          <col key={columns[i].key} style={{ width: w }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} aria-sort={ariaSort(c.key)}>
              {c.sortValue ? (
                <button type="button" onClick={() => toggleSort(c.key)}>
                  {c.header}
                </button>
              ) : (
                c.header
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="grid-empty">
              Aucune donnée.
            </td>
          </tr>
        ) : (
          sorted.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key}>{c.render(row)}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
`,
  "src/components/DataGrid.css": `.grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.grid th,
.grid td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grid th {
  position: relative;
  text-align: left;
  color: var(--muted);
}

.grid-empty {
  text-align: center;
  color: var(--muted);
}
`,
  "src/hooks/useColumns.ts": `import { useCallback, useState } from "react";

const MIN_WIDTH = 80;

export function useColumns(initial: number[]) {
  const [widths, setWidths] = useState(initial);
  const resize = useCallback((index: number, delta: number) => {
    setWidths((w) => w.map((x, i) => (i === index ? Math.max(MIN_WIDTH, x + delta) : x)));
  }, []);
  return { widths, resize };
}
`,
  "src/hooks/useSort.ts": `export type SortDirection = "asc" | "desc";

export interface SortState {
  key: string;
  direction: SortDirection;
}

export function sortRows<T>(rows: T[], value: (row: T) => string | number, direction: SortDirection): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    return (va < vb ? -1 : va > vb ? 1 : 0) * factor;
  });
}
`,
  "src/styles/theme.css": `:root {
  --bg: #ffffff;
  --fg: #111827;
  --muted: #6b7280;
  --border: #e5e7eb;
  --accent: #2563eb;
}

.theme-dark {
  --bg: #0b1020;
  --fg: #e5e7eb;
  --muted: #9ca3af;
  --border: #1f2937;
  --accent: #60a5fa;
}

.app {
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
}

.btn {
  border-radius: 6px;
  padding: 0.375rem 0.75rem;
}

.btn-primary {
  background: var(--accent);
  color: var(--bg);
}

.btn-ghost {
  background: transparent;
  color: var(--fg);
}
`,
};

// ── warden (this repository) ───────────────────────────────────────────────

const warden: Record<string, string> = {
  "README.md": wardenReadme,
  "package.json": wardenPackage,
  "docs/cahier-des-charges.md": wardenCdc,
  "docs/decisions.md": wardenDecisions,
  "docs/specs/stage-0-prototype-ux.md": wardenPlan,
  "src/main.tsx": wardenMain,
  "src/index.css": wardenCss,
  "src/app/App.tsx": wardenApp,
  "src/app/AppShell.tsx": wardenAppShell,
  "src/lib/links.ts": wardenLinks,
  "src/mock/types.ts": wardenTypes,
  "src-tauri/Cargo.toml": wardenCargo,
  "src-tauri/tauri.conf.json": wardenTauriConf,
  "src-tauri/src/main.rs": wardenRustMain,
  "src-tauri/src/lib.rs": wardenLib,
};

/** File contents per project, keyed by repository-relative path. */
export const fileContents: Record<string, Record<string, string>> = {
  "atlas-api": atlasApi,
  "lumen-web": lumenWeb,
  warden,
};

/** Directories first, then files, each alphabetically. */
function buildTree(paths: string[]): FileNode[] {
  const root: FileNode[] = [];
  for (const path of paths) {
    const parts = path.split("/");
    let level = root;
    parts.forEach((name, i) => {
      const nodePath = parts.slice(0, i + 1).join("/");
      const isFile = i === parts.length - 1;
      let node = level.find((n) => n.name === name);
      if (!node) {
        node = isFile ? { name, path: nodePath, kind: "file" } : { name, path: nodePath, kind: "dir", children: [] };
        level.push(node);
      }
      if (node.children) level = node.children;
    });
  }
  const sort = (nodes: FileNode[]): FileNode[] =>
    nodes
      .map((n) => (n.children ? { ...n, children: sort(n.children) } : n))
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "dir" ? -1 : 1));
  return sort(root);
}

export const fileTrees: Record<string, FileNode[]> = Object.fromEntries(
  Object.entries(fileContents).map(([projectId, files]) => [projectId, buildTree(Object.keys(files))]),
);

/** Unified diff of a file created from scratch. */
function addedFileDiff(path: string, content: string): string {
  const lines = content.replace(/\n$/, "").split("\n");
  return [`--- /dev/null`, `+++ b/${path}`, `@@ -0,0 +1,${lines.length} @@`, ...lines.map((l) => `+${l}`)].join("\n");
}

const INVOICE_DIFF = `--- a/src/billing/invoice.ts
+++ b/src/billing/invoice.ts
@@ -1,2 +1,3 @@
 import { db } from "../db";
+import { computeTax, type TaxBreakdown } from "./tax";
 
@@ -6,5 +7,7 @@ export interface InvoiceLine {
   /** Unit price excluding tax, in cents. */
   unitPrice: number;
+  /** Overrides the customer's default VAT rate (e.g. reduced rate). */
+  vatRate?: number;
 }
 
 export interface Invoice {
@@ -12,13 +15,27 @@ export interface Invoice {
   customerId: string;
+  country: string;
   lines: InvoiceLine[];
-  total: number;
+  subtotal: number;
+  tax: TaxBreakdown;
+  total: number;
   issuedAt: Date;
 }
 
 export async function createInvoice(customerId: string, lines: InvoiceLine[]): Promise<Invoice> {
-  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
-  const invoice: Invoice = { id: crypto.randomUUID(), customerId, lines, total, issuedAt: new Date() };
+  if (lines.length === 0) throw new Error("An invoice needs at least one line");
+  const customer = await db.customers.get(customerId);
+  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
+  const tax = computeTax(lines, { country: customer.country, vatId: customer.vatId });
+  const invoice: Invoice = {
+    id: crypto.randomUUID(),
+    customerId,
+    country: customer.country,
+    lines,
+    subtotal,
+    tax,
+    total: subtotal + tax.total,
+    issuedAt: new Date(),
+  };
   await db.invoices.insert(invoice);
   return invoice;
 }`;

const XML_EXPORT_DELETION_DIFF = `--- a/src/legacy/xml-export.ts
+++ /dev/null
@@ -1,24 +0,0 @@
-/**
- * Legacy XML export for the 2019 accounting integration.
- * No client has called /exports/xml since March; scheduled for removal.
- */
-import type { Invoice } from "../billing/invoice";
-
-const escape = (s: string) =>
-  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
-
-export function invoiceToXml(invoice: Invoice): string {
-  const lines = invoice.lines
-    .map(
-      (l) =>
-        "    <line quantity=\\"" + l.quantity + "\\" unitPrice=\\"" + l.unitPrice + "\\">" +
-        escape(l.description) +
-        "</line>",
-    )
-    .join("\\n");
-  return [
-    '<?xml version="1.0" encoding="UTF-8"?>',
-    '<invoice id="' + escape(invoice.id) + '" customer="' + escape(invoice.customerId) + '">',
-    lines,
-    "</invoice>",
-  ].join("\\n");
-}`;

/**
 * Diffs of session changes that are absent from the abridged traces (only s-atlas-101, s-atlas-102 and
 * s-lumen-201 have full traces). Stands for the git diff Warden would record at the end of a session.
 */
export const sessionDiffs: Record<string, Record<string, string>> = {
  "s-atlas-097": {
    "src/billing/invoice.ts": INVOICE_DIFF,
    "src/billing/tax.ts": addedFileDiff("src/billing/tax.ts", atlasApi["src/billing/tax.ts"]),
  },
  "s-atlas-095": {
    "src/legacy/xml-export.ts": XML_EXPORT_DELETION_DIFF,
  },
  "s-warden-301": {
    "docs/specs/stage-0-prototype-ux.md": addedFileDiff("docs/specs/stage-0-prototype-ux.md", wardenPlan),
  },
};
