import type {
  Observation,
  PermissionDecision,
  PermissionKind,
  Session,
  TraceEvent,
  TraceEventKind,
  TraceEventStatus,
} from "@/mock/types";
import { sessions } from "./sessions";

/**
 * Step description; `at` is an offset in seconds from the session start.
 * `raw` is generated to look like the ACP JSON-RPC message Warden would have received.
 */
interface Step {
  key: string;
  at: number;
  kind: TraceEventKind;
  title: string;
  parent?: string;
  durationMs?: number;
  status?: TraceEventStatus;
  text?: string;
  tool?: string;
  file?: { path: string; line?: number };
  diff?: string;
  command?: string;
  output?: string;
  exitCode?: number;
  permission?: { kind: PermissionKind; decision?: PermissionDecision; reason: string };
  tokens?: { input: Observation<number>; output: Observation<number> };
  cost?: Observation<number>;
}

const unavailable: Observation<number> = {
  value: null,
  confidence: "unavailable",
  note: "Pas de détail par appel via ACP",
};
const observed = (value: number, source = "Agent SDK usage"): Observation<number> => ({
  value,
  confidence: "observed",
  source,
});

function toolKind(kind: TraceEventKind): string {
  switch (kind) {
    case "file-read":
      return "read";
    case "file-edit":
      return "edit";
    case "command":
      return "execute";
    default:
      return "other";
  }
}

function rawFor(acpSessionId: string, id: string, s: Step): unknown {
  switch (s.kind) {
    case "session-start":
      return { jsonrpc: "2.0", id: 1, method: "session/new", params: { cwd: "<project>", mcpServers: [] } };
    case "user-prompt":
      return {
        jsonrpc: "2.0",
        id: 2,
        method: "session/prompt",
        params: { sessionId: acpSessionId, prompt: [{ type: "text", text: s.text }] },
      };
    case "assistant-message":
      return {
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          sessionId: acpSessionId,
          update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: s.text } },
        },
      };
    case "thinking":
      return {
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          sessionId: acpSessionId,
          update: { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: s.text } },
        },
      };
    case "model-call":
      return s.tokens?.input.confidence === "observed"
        ? {
            source: "harness",
            type: "assistant",
            message: { usage: { input_tokens: s.tokens.input.value, output_tokens: s.tokens.output.value } },
          }
        : {
            _warden: "inferred",
            note: "Appel modèle déduit des frontières entre messages ACP ; aucun événement natif.",
          };
    case "permission-request":
      return {
        jsonrpc: "2.0",
        id: 7,
        method: "session/request_permission",
        params: {
          sessionId: acpSessionId,
          toolCall: { toolCallId: id },
          options: [
            { optionId: "allow-once", kind: "allow_once", name: "Autoriser une fois" },
            { optionId: "allow-always", kind: "allow_always", name: "Toujours autoriser" },
            { optionId: "reject-once", kind: "reject_once", name: "Refuser" },
          ],
        },
      };
    case "interrupt":
      return { jsonrpc: "2.0", method: "session/cancel", params: { sessionId: acpSessionId } };
    case "session-end":
      return { jsonrpc: "2.0", id: 2, result: { stopReason: s.status === "cancelled" ? "cancelled" : "end_turn" } };
    case "error":
      return {
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          sessionId: acpSessionId,
          update: { sessionUpdate: "tool_call_update", toolCallId: id, status: "failed" },
        },
      };
    default:
      return {
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          sessionId: acpSessionId,
          update: {
            sessionUpdate: "tool_call",
            toolCallId: id,
            title: s.title,
            kind: toolKind(s.kind),
            status: s.status === "ok" ? "completed" : s.status === "error" ? "failed" : (s.status ?? "completed"),
            locations: s.file ? [{ path: s.file.path, line: s.file.line }] : [],
            rawInput: s.command ? { command: s.command } : undefined,
          },
        },
      };
  }
}

function build(sessionId: string, steps: Step[]): TraceEvent[] {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error(`Unknown session ${sessionId}`);
  const start = new Date(session.startedAt).getTime();
  const acpSessionId = `acp_${sessionId.replace(/-/g, "")}`;
  const ids = new Map(steps.map((s) => [s.key, `${sessionId}:${s.key}`]));
  return steps.map((s) => {
    const id = ids.get(s.key) as string;
    return {
      id,
      sessionId,
      parentId: s.parent ? ids.get(s.parent) : undefined,
      kind: s.kind,
      at: new Date(start + s.at * 1000).toISOString(),
      durationMs: s.durationMs,
      title: s.title,
      status: s.status,
      text: s.text,
      tool: s.tool,
      file: s.file,
      diff: s.diff,
      command: s.command,
      output: s.output,
      exitCode: s.exitCode,
      permission: s.permission,
      tokens: s.tokens,
      cost: s.cost,
      raw: rawFor(acpSessionId, id, s),
    };
  });
}

// ── s-atlas-101 — OpenCode, full debugging trace ───────────────────────────

const REFRESH_TEST_DIFF = `--- a/src/auth/__tests__/refresh.test.ts
+++ b/src/auth/__tests__/refresh.test.ts
@@ -48,3 +48,25 @@ describe("refresh tokens", () => {
     expect(token.userId).toBe(user.id);
   });
+
+  it("expires after REFRESH_TOKEN_TTL, not ACCESS_TOKEN_TTL", async () => {
+    const now = new Date("2026-10-07T12:00:00Z");
+    vi.setSystemTime(now);
+    const token = await issueRefreshToken(user);
+
+    vi.setSystemTime(addMinutes(now, 16));
+    await expect(rotateRefreshToken(token.value)).resolves.toBeDefined();
+
+    vi.setSystemTime(addDays(now, 8));
+    await expect(rotateRefreshToken(token.value)).rejects.toThrow(TokenExpiredError);
+  });
 });`;

const REFRESH_FIX_DIFF = `--- a/src/auth/refresh.ts
+++ b/src/auth/refresh.ts
@@ -18,14 +18,22 @@ import { env } from "../config/env";
 export async function issueRefreshToken(user: User): Promise<RefreshToken> {
   const value = randomBytes(32).toString("base64url");
-  const expiresAt = new Date(Date.now() + env.ACCESS_TOKEN_TTL * 1000);
+  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000);
   await db.refreshTokens.insert({ userId: user.id, hash: sha256(value), expiresAt });
   return { value, userId: user.id, expiresAt };
 }

 export async function rotateRefreshToken(value: string): Promise<RefreshToken> {
   const stored = await db.refreshTokens.findByHash(sha256(value));
-  if (!stored || stored.expiresAt < new Date()) {
-    throw new TokenExpiredError();
-  }
+  if (!stored) {
+    throw new InvalidTokenError();
+  }
+  if (stored.expiresAt.getTime() <= Date.now()) {
+    await db.refreshTokens.delete(stored.id);
+    throw new TokenExpiredError();
+  }
   await db.refreshTokens.delete(stored.id);
   return issueRefreshToken({ id: stored.userId });
 }`;

const atlas101 = build("s-atlas-101", [
  { key: "start", at: 0, kind: "session-start", title: "Session démarrée · OpenCode · Claude Sonnet", status: "ok" },
  {
    key: "prompt",
    at: 4,
    kind: "user-prompt",
    title: "Prompt",
    text: "Les refresh tokens expirent au bout de 15 minutes au lieu de 7 jours. Trouve la cause et corrige-la avec un test de régression.",
  },
  {
    key: "m1",
    at: 6,
    kind: "model-call",
    title: "Appel modèle #1",
    durationMs: 9_000,
    status: "ok",
    tokens: { input: unavailable, output: unavailable },
  },
  {
    key: "m1-think",
    at: 7,
    parent: "m1",
    kind: "thinking",
    title: "Réflexion",
    text: "15 minutes correspond exactement au TTL des access tokens. Hypothèse : le refresh token réutilise la mauvaise constante.",
  },
  {
    key: "m1-msg",
    at: 14,
    parent: "m1",
    kind: "assistant-message",
    title: "Message",
    text: "Je commence par lire la logique d'émission des refresh tokens.",
  },
  {
    key: "read-refresh",
    at: 15,
    parent: "m1",
    kind: "file-read",
    title: "Lire src/auth/refresh.ts",
    tool: "read",
    status: "ok",
    file: { path: "src/auth/refresh.ts" },
    durationMs: 40,
  },
  {
    key: "grep-ttl",
    at: 16,
    parent: "m1",
    kind: "tool-call",
    title: "Rechercher TOKEN_TTL",
    tool: "grep",
    status: "ok",
    durationMs: 120,
    command: 'grep -rn "TOKEN_TTL" src',
    output:
      "src/config/env.ts:12:  ACCESS_TOKEN_TTL: num(900),\nsrc/config/env.ts:13:  REFRESH_TOKEN_TTL: num(604800),\nsrc/auth/refresh.ts:20:  const expiresAt = new Date(Date.now() + env.ACCESS_TOKEN_TTL * 1000);\nsrc/auth/access.ts:9:  exp: now + env.ACCESS_TOKEN_TTL,",
  },
  {
    key: "read-env",
    at: 18,
    parent: "m1",
    kind: "file-read",
    title: "Lire src/config/env.ts:12",
    tool: "read",
    status: "ok",
    file: { path: "src/config/env.ts", line: 12 },
    durationMs: 30,
  },
  {
    key: "read-test",
    at: 19,
    parent: "m1",
    kind: "file-read",
    title: "Lire src/auth/__tests__/refresh.test.ts",
    tool: "read",
    status: "ok",
    file: { path: "src/auth/__tests__/refresh.test.ts" },
    durationMs: 35,
  },
  {
    key: "m2",
    at: 21,
    kind: "model-call",
    title: "Appel modèle #2",
    durationMs: 14_000,
    status: "ok",
    tokens: { input: unavailable, output: unavailable },
  },
  {
    key: "m2-msg",
    at: 34,
    parent: "m2",
    kind: "assistant-message",
    title: "Message",
    text: "Cause trouvée : `issueRefreshToken` utilise `env.ACCESS_TOKEN_TTL` (900 s) au lieu de `env.REFRESH_TOKEN_TTL` (7 jours). J'ajoute d'abord un test qui reproduit le bug.",
  },
  {
    key: "edit-test",
    at: 36,
    parent: "m2",
    kind: "file-edit",
    title: "Modifier src/auth/__tests__/refresh.test.ts",
    tool: "edit",
    status: "ok",
    file: { path: "src/auth/__tests__/refresh.test.ts", line: 49 },
    diff: REFRESH_TEST_DIFF,
    durationMs: 60,
  },
  {
    key: "perm-1",
    at: 38,
    parent: "m2",
    kind: "permission-request",
    title: "Exécuter : npm test -- auth/refresh",
    status: "ok",
    durationMs: 41_000,
    permission: {
      kind: "shell",
      decision: "allow-once",
      reason: "L'agent veut lancer la suite de tests du module auth.",
    },
  },
  {
    key: "test-1",
    at: 79,
    parent: "m2",
    kind: "command",
    title: "npm test -- auth/refresh",
    tool: "shell",
    status: "error",
    command: "npm test -- auth/refresh",
    exitCode: 1,
    durationMs: 6_800,
    output:
      " FAIL  src/auth/__tests__/refresh.test.ts\n  ✕ expires after REFRESH_TOKEN_TTL, not ACCESS_TOKEN_TTL (12 ms)\n\n  ● refresh tokens › expires after REFRESH_TOKEN_TTL, not ACCESS_TOKEN_TTL\n\n    TokenExpiredError: refresh token expired\n      at rotateRefreshToken (src/auth/refresh.ts:29:11)\n\nTests: 1 failed, 6 passed, 7 total",
  },
  {
    key: "m3",
    at: 87,
    kind: "model-call",
    title: "Appel modèle #3",
    durationMs: 12_000,
    status: "ok",
    tokens: { input: unavailable, output: unavailable },
  },
  {
    key: "m3-msg",
    at: 98,
    parent: "m3",
    kind: "assistant-message",
    title: "Message",
    text: "Le test échoue comme prévu. Je corrige le TTL et je distingue token invalide et token expiré.",
  },
  {
    key: "edit-fix",
    at: 100,
    parent: "m3",
    kind: "file-edit",
    title: "Modifier src/auth/refresh.ts",
    tool: "edit",
    status: "ok",
    file: { path: "src/auth/refresh.ts", line: 20 },
    diff: REFRESH_FIX_DIFF,
    durationMs: 55,
  },
  {
    key: "read-session",
    at: 102,
    parent: "m3",
    kind: "file-read",
    title: "Lire src/auth/session.ts",
    tool: "read",
    status: "ok",
    file: { path: "src/auth/session.ts" },
    durationMs: 30,
  },
  {
    key: "perm-2",
    at: 104,
    parent: "m3",
    kind: "permission-request",
    title: "Exécuter : npm test -- auth",
    status: "ok",
    durationMs: 12_000,
    permission: { kind: "shell", decision: "allow-always", reason: "L'agent veut relancer les tests du module auth." },
  },
  {
    key: "test-2",
    at: 116,
    parent: "m3",
    kind: "command",
    title: "npm test -- auth",
    tool: "shell",
    status: "ok",
    command: "npm test -- auth",
    exitCode: 0,
    durationMs: 9_400,
    output:
      " PASS  src/auth/__tests__/refresh.test.ts\n PASS  src/auth/__tests__/access.test.ts\n PASS  src/auth/__tests__/session.test.ts\n\nTests: 19 passed, 19 total",
  },
  {
    key: "m4",
    at: 127,
    kind: "model-call",
    title: "Appel modèle #4",
    durationMs: 8_000,
    status: "ok",
    tokens: { input: unavailable, output: unavailable },
  },
  {
    key: "m4-msg",
    at: 135,
    parent: "m4",
    kind: "assistant-message",
    title: "Message",
    text: "Corrigé.\n\n**Cause** : `issueRefreshToken` calculait l'expiration avec `ACCESS_TOKEN_TTL` (15 min).\n\n**Changements**\n- `src/auth/refresh.ts` : utilise `REFRESH_TOKEN_TTL`, supprime le token expiré et distingue `InvalidTokenError` de `TokenExpiredError`.\n- `src/auth/__tests__/refresh.test.ts` : test de régression sur 16 min / 8 jours.\n\n**Vérification** : `npm test -- auth` → 19/19.",
  },
  {
    key: "m5",
    at: 1_130,
    kind: "model-call",
    title: "Appel modèle #5 (titre de session)",
    durationMs: 2_000,
    status: "ok",
    tokens: { input: unavailable, output: unavailable },
  },
  { key: "end", at: 1_140, kind: "session-end", title: "Session terminée", status: "ok" },
]);

// ── s-atlas-102 — same task with Claude Code (per-call tokens observed) ────

const atlas102 = build("s-atlas-102", [
  { key: "start", at: 0, kind: "session-start", title: "Session démarrée · Claude Code · Claude Sonnet", status: "ok" },
  {
    key: "prompt",
    at: 3,
    kind: "user-prompt",
    title: "Prompt",
    text: "Les refresh tokens expirent au bout de 15 minutes au lieu de 7 jours. Trouve la cause et corrige-la avec un test de régression.",
  },
  {
    key: "m1",
    at: 4,
    kind: "model-call",
    title: "Appel modèle #1",
    durationMs: 6_000,
    status: "ok",
    tokens: { input: observed(16_200), output: observed(310) },
    cost: observed(0.05, "Agent SDK"),
  },
  {
    key: "m1-msg",
    at: 9,
    parent: "m1",
    kind: "assistant-message",
    title: "Message",
    text: "Je cherche où l'expiration du refresh token est calculée.",
  },
  {
    key: "grep",
    at: 10,
    parent: "m1",
    kind: "tool-call",
    title: "Grep TOKEN_TTL",
    tool: "Grep",
    status: "ok",
    command: 'Grep "TOKEN_TTL"',
    output: "src/config/env.ts:12\nsrc/config/env.ts:13\nsrc/auth/refresh.ts:20\nsrc/auth/access.ts:9",
    durationMs: 90,
  },
  {
    key: "read",
    at: 11,
    parent: "m1",
    kind: "file-read",
    title: "Read src/auth/refresh.ts",
    tool: "Read",
    status: "ok",
    file: { path: "src/auth/refresh.ts" },
    durationMs: 25,
  },
  {
    key: "m2",
    at: 12,
    kind: "model-call",
    title: "Appel modèle #2",
    durationMs: 9_000,
    status: "ok",
    tokens: { input: observed(18_900), output: observed(1_240) },
    cost: observed(0.06, "Agent SDK"),
  },
  {
    key: "edit",
    at: 21,
    parent: "m2",
    kind: "file-edit",
    title: "Edit src/auth/refresh.ts",
    tool: "Edit",
    status: "ok",
    file: { path: "src/auth/refresh.ts", line: 20 },
    diff: `--- a/src/auth/refresh.ts
+++ b/src/auth/refresh.ts
@@ -18,7 +18,7 @@ import { env } from "../config/env";
 export async function issueRefreshToken(user: User): Promise<RefreshToken> {
   const value = randomBytes(32).toString("base64url");
-  const expiresAt = new Date(Date.now() + env.ACCESS_TOKEN_TTL * 1000);
+  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000);
   await db.refreshTokens.insert({ userId: user.id, hash: sha256(value), expiresAt });
   return { value, userId: user.id, expiresAt };
 }`,
    durationMs: 40,
  },
  {
    key: "perm",
    at: 22,
    parent: "m2",
    kind: "permission-request",
    title: "Bash : npm test -- auth",
    status: "ok",
    durationMs: 8_000,
    permission: { kind: "shell", decision: "allow-once", reason: "Lancer les tests du module auth." },
  },
  {
    key: "test",
    at: 30,
    parent: "m2",
    kind: "command",
    title: "npm test -- auth",
    tool: "Bash",
    status: "ok",
    command: "npm test -- auth",
    exitCode: 0,
    durationMs: 9_100,
    output: "Tests: 18 passed, 18 total",
  },
  {
    key: "m3",
    at: 40,
    kind: "model-call",
    title: "Appel modèle #3",
    durationMs: 5_000,
    status: "ok",
    tokens: { input: observed(20_400), output: observed(820) },
    cost: observed(0.07, "Agent SDK"),
  },
  {
    key: "m3-msg",
    at: 45,
    parent: "m3",
    kind: "assistant-message",
    title: "Message",
    text: "Corrigé : `issueRefreshToken` utilisait `ACCESS_TOKEN_TTL`. Les tests existants passent.\n\n_Note : je n'ai pas ajouté de test de régression._",
  },
  { key: "end", at: 660, kind: "session-end", title: "Session terminée", status: "ok" },
]);

// ── s-lumen-201 — OpenCode, permission denied then interrupted ─────────────

const lumen201 = build("s-lumen-201", [
  { key: "start", at: 0, kind: "session-start", title: "Session démarrée · OpenCode · Claude Sonnet", status: "ok" },
  {
    key: "prompt",
    at: 5,
    kind: "user-prompt",
    title: "Prompt",
    text: "Rends les colonnes de DataGrid redimensionnables à la souris, avec une largeur minimale de 80 px.",
  },
  {
    key: "m1",
    at: 7,
    kind: "model-call",
    title: "Appel modèle #1",
    durationMs: 11_000,
    status: "ok",
    tokens: { input: unavailable, output: unavailable },
  },
  {
    key: "read",
    at: 18,
    parent: "m1",
    kind: "file-read",
    title: "Lire src/components/DataGrid.tsx",
    tool: "read",
    status: "ok",
    file: { path: "src/components/DataGrid.tsx" },
    durationMs: 30,
  },
  {
    key: "perm",
    at: 20,
    parent: "m1",
    kind: "permission-request",
    title: "Exécuter : npm install react-resizable-panels",
    status: "denied",
    durationMs: 22_000,
    permission: {
      kind: "network",
      decision: "deny",
      reason: "L'agent veut ajouter une dépendance (accès réseau + modification de package.json).",
    },
  },
  {
    key: "m2",
    at: 43,
    kind: "model-call",
    title: "Appel modèle #2",
    durationMs: 15_000,
    status: "ok",
    tokens: { input: unavailable, output: unavailable },
  },
  {
    key: "m2-msg",
    at: 57,
    parent: "m2",
    kind: "assistant-message",
    title: "Message",
    text: "Compris, sans dépendance. J'implémente le redimensionnement avec des pointer events dans un hook dédié.",
  },
  {
    key: "hook",
    at: 60,
    parent: "m2",
    kind: "file-edit",
    title: "Créer src/hooks/useColumns.ts",
    tool: "write",
    status: "ok",
    file: { path: "src/hooks/useColumns.ts" },
    diff: `--- /dev/null
+++ b/src/hooks/useColumns.ts
@@ -0,0 +1,12 @@
+import { useCallback, useState } from "react";
+
+const MIN_WIDTH = 80;
+
+export function useColumns(initial: number[]) {
+  const [widths, setWidths] = useState(initial);
+  const resize = useCallback((index: number, delta: number) => {
+    setWidths((w) => w.map((x, i) => (i === index ? Math.max(MIN_WIDTH, x + delta) : x)));
+  }, []);
+  return { widths, resize };
+}`,
    durationMs: 50,
  },
  {
    key: "edit",
    at: 75,
    parent: "m2",
    kind: "file-edit",
    title: "Modifier src/components/DataGrid.tsx",
    tool: "edit",
    status: "ok",
    file: { path: "src/components/DataGrid.tsx", line: 42 },
    diff: `--- a/src/components/DataGrid.tsx
+++ b/src/components/DataGrid.tsx
@@ -40,6 +40,9 @@ export function DataGrid<T>({ columns, rows }: DataGridProps<T>) {
-  return (
-    <table className="grid">
+  const { widths, resize } = useColumns(columns.map((c) => c.width ?? 160));
+  return (
+    <table className="grid" style={{ tableLayout: "fixed" }}>`,
    durationMs: 45,
  },
  {
    key: "err",
    at: 90,
    parent: "m2",
    kind: "error",
    title: "Échec de l'outil edit : old_string introuvable",
    status: "error",
    file: { path: "src/components/DataGrid.tsx", line: 58 },
    output: "Error: old_string not found in src/components/DataGrid.tsx",
  },
  { key: "int", at: 1_190, kind: "interrupt", title: "Session interrompue par l'utilisateur", status: "cancelled" },
  { key: "end", at: 1_200, kind: "session-end", title: "Session arrêtée", status: "cancelled" },
]);

// ── Minimal traces for the other sessions ──────────────────────────────────

function minimal(session: Session): TraceEvent[] {
  const end = session.endedAt
    ? (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000
    : 60;
  const endStatus: TraceEventStatus =
    session.status === "completed" ? "ok" : session.status === "failed" ? "error" : "cancelled";
  return build(session.id, [
    { key: "start", at: 0, kind: "session-start", title: "Session démarrée", status: "ok" },
    { key: "prompt", at: 3, kind: "user-prompt", title: "Prompt", text: session.title },
    {
      key: "m1",
      at: 5,
      kind: "model-call",
      title: "Appel modèle #1",
      durationMs: 10_000,
      status: "ok",
      tokens: { input: unavailable, output: unavailable },
    },
    {
      key: "m1-msg",
      at: 15,
      parent: "m1",
      kind: "assistant-message",
      title: "Message",
      text: "_Trace abrégée dans la maquette : seules les sessions s-atlas-101, s-atlas-102 et s-lumen-201 ont une trace complète._",
    },
    ...(session.status === "failed"
      ? [
          {
            key: "err",
            at: end - 30,
            kind: "error" as const,
            title: "La commande de build a échoué (exit 2)",
            status: "error" as const,
            output: "tsc: 4 errors",
          },
        ]
      : []),
    { key: "end", at: end, kind: "session-end", title: "Session terminée", status: endStatus },
  ]);
}

const detailed: Record<string, TraceEvent[]> = {
  "s-atlas-101": atlas101,
  "s-atlas-102": atlas102,
  "s-lumen-201": lumen201,
};

export const traces: Record<string, TraceEvent[]> = Object.fromEntries(
  sessions.map((s) => [s.id, detailed[s.id] ?? minimal(s)]),
);
