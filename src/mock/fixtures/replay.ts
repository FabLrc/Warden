import type { PermissionKind } from "@/mock/types";

/**
 * Scripted agent run replayed when the user sends a prompt in the prototype (no real harness).
 * The script is prompt-agnostic: the agent explores the repository, proposes a change, then verifies it.
 * Gated steps (edit, commands) go through the permission flow; `onDenied` replaces the rest of the script.
 */
export type ReplayStep =
  | { kind: "turn"; inputTokens: number }
  | { kind: "thinking"; text: string }
  | { kind: "message"; text: string }
  | { kind: "file-read"; path: string; line?: number }
  | { kind: "search"; title: string; command: string; output: string }
  | { kind: "file-edit"; path: string; line: number; diff: string; reason: string; onDenied: ReplayStep[] }
  | {
      kind: "command";
      command: string;
      output: string;
      exitCode: number;
      durationMs: number;
      permission: PermissionKind;
      reason: string;
      onDenied: ReplayStep[];
    };

interface ProjectReplay {
  reads: { path: string; line?: number }[];
  search: { command: string; output: string };
  edit: { path: string; line: number; diff: string; summary: string };
  test: { command: string; output: string };
  typecheck: { command: string; output: string };
}

const PROJECT_REPLAYS: Record<string, ProjectReplay> = {
  "atlas-api": {
    reads: [{ path: "src/auth/session.ts" }, { path: "src/config/env.ts", line: 12 }],
    search: {
      command: 'rg -n "expiresAt" src/auth',
      output:
        "src/auth/session.ts:14:  const session = await db.sessions.findByToken(sha256(token));\nsrc/auth/session.ts:22:    expiresAt: new Date(Date.now() + env.SESSION_TTL * 1000),\nsrc/auth/refresh.ts:20:  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000);",
    },
    edit: {
      path: "src/auth/session.ts",
      line: 15,
      summary:
        "`loadSession` renvoie une session même lorsqu'elle a expiré : il manque une vérification de `expiresAt`.",
      diff: `--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ -13,5 +13,12 @@ import { env } from "../config/env";
 export async function loadSession(token: string): Promise<Session | null> {
   const session = await db.sessions.findByToken(sha256(token));
-  if (!session) return null;
+  if (!session) {
+    return null;
+  }
+  if (session.expiresAt.getTime() <= Date.now()) {
+    await db.sessions.delete(session.id);
+    return null;
+  }
   return session;
 }`,
    },
    test: {
      command: "npm test -- auth",
      output:
        " PASS  src/auth/__tests__/refresh.test.ts\n PASS  src/auth/__tests__/access.test.ts\n PASS  src/auth/__tests__/session.test.ts\n\nTests: 20 passed, 20 total\nTime:  4.12 s",
    },
    typecheck: { command: "npx tsc --noEmit", output: "" },
  },
  "lumen-web": {
    reads: [{ path: "src/components/DataGrid.tsx" }, { path: "src/hooks/useColumns.ts" }],
    search: {
      command: 'rg -n "rows.length" src/components',
      output: "src/components/DataGrid.tsx:61:        {rows.length > 0 && <tbody>{rows.map(renderRow)}</tbody>}",
    },
    edit: {
      path: "src/components/DataGrid.tsx",
      line: 39,
      summary: "Quand `rows` est vide, la grille affiche un tableau sans corps ni message.",
      diff: `--- a/src/components/DataGrid.tsx
+++ b/src/components/DataGrid.tsx
@@ -38,3 +38,10 @@ export function DataGrid<T>({ columns, rows }: DataGridProps<T>) {
   const { widths, resize } = useColumns(columns.map((c) => c.width ?? 160));
+  if (rows.length === 0) {
+    return (
+      <div role="status" className="grid-empty">
+        Aucune ligne à afficher
+      </div>
+    );
+  }
   return (`,
    },
    test: {
      command: "npm run test:unit",
      output:
        " ✓ src/components/DataGrid.test.tsx (6 tests)\n ✓ src/hooks/useColumns.test.ts (3 tests)\n\n Test Files  2 passed (2)\n      Tests  9 passed (9)",
    },
    typecheck: { command: "npx tsc --noEmit", output: "" },
  },
  warden: {
    reads: [{ path: "src/app/AppShell.tsx", line: 217 }, { path: "src/lib/links.ts" }],
    search: {
      command: 'rg -n "slice\\(0, 8\\)" src',
      output: "src/app/AppShell.tsx:219:            .slice(0, 8)",
    },
    edit: {
      path: "src/app/AppShell.tsx",
      line: 219,
      summary: "La limite des sessions récentes est codée en dur dans la sidebar Observe.",
      diff: `--- a/src/app/AppShell.tsx
+++ b/src/app/AppShell.tsx
@@ -217,5 +217,5 @@ function ObserveSidebar() {
         <SidebarGroup title="Récentes">
           {allSessionsNewestFirst()
-            .slice(0, 8)
+            .slice(0, RECENT_SESSIONS_LIMIT)
             .map((s) => (`,
    },
    test: {
      command: "npm run build",
      output:
        "vite v8.0.0 building for production...\n✓ 2148 modules transformed.\ndist/index.html  0.46 kB\n✓ built in 3.81s",
    },
    typecheck: { command: "npx tsc --noEmit", output: "" },
  },
};

const replayFor = (projectId: string): ProjectReplay => PROJECT_REPLAYS[projectId] ?? PROJECT_REPLAYS["atlas-api"];

/** First prompt of a live session: explore → propose a change → run tests → typecheck → summary. */
export function replayScript(projectId: string): ReplayStep[] {
  const r = replayFor(projectId);
  return [
    { kind: "turn", inputTokens: 12_400 },
    {
      kind: "thinking",
      text: "Avant de modifier quoi que ce soit, je dois situer le code concerné et la façon dont il est testé dans ce dépôt.",
    },
    { kind: "message", text: "Je commence par explorer le dépôt pour situer le code concerné." },
    ...r.reads.map((f): ReplayStep => ({ kind: "file-read", path: f.path, line: f.line })),
    { kind: "search", title: "Rechercher dans le code", command: r.search.command, output: r.search.output },
    { kind: "turn", inputTokens: 18_900 },
    {
      kind: "message",
      text: `J'ai trouvé l'endroit à modifier : \`${r.edit.path}\`. ${r.edit.summary} Je fais la modification.`,
    },
    {
      kind: "file-edit",
      path: r.edit.path,
      line: r.edit.line,
      diff: r.edit.diff,
      reason: `L'agent veut modifier ${r.edit.path}.`,
      onDenied: [
        { kind: "turn", inputTokens: 19_600 },
        {
          kind: "message",
          text: `D'accord, je ne modifie pas \`${r.edit.path}\`. Voici le changement que je proposais, à appliquer vous-même si vous le souhaitez :\n\n\`\`\`diff\n${r.edit.diff}\n\`\`\``,
        },
      ],
    },
    { kind: "message", text: `Je lance \`${r.test.command}\` pour vérifier que rien n'est cassé.` },
    {
      kind: "command",
      command: r.test.command,
      output: r.test.output,
      exitCode: 0,
      durationMs: 3_200,
      permission: "shell",
      reason: "L'agent veut lancer la suite de tests du projet.",
      onDenied: [
        { kind: "turn", inputTokens: 21_300 },
        {
          kind: "message",
          text: `Compris, je ne lance pas \`${r.test.command}\`.\n\nLa modification de \`${r.edit.path}\` est en place mais **non vérifiée** : pensez à lancer \`${r.test.command}\` avant de committer.`,
        },
      ],
    },
    { kind: "turn", inputTokens: 22_100 },
    { kind: "message", text: "Les tests passent. Je vérifie aussi les types." },
    {
      kind: "command",
      command: r.typecheck.command,
      output: r.typecheck.output,
      exitCode: 0,
      durationMs: 2_400,
      permission: "shell",
      reason: "L'agent veut lancer la vérification de types.",
      onDenied: [
        { kind: "turn", inputTokens: 23_000 },
        {
          kind: "message",
          text: `Je n'exécute pas \`${r.typecheck.command}\`. Les tests passent avec la modification de \`${r.edit.path}\` ; la vérification de types reste à faire.`,
        },
      ],
    },
    { kind: "turn", inputTokens: 24_600 },
    {
      kind: "message",
      text: `C'est fait.\n\n**Changement**\n- \`${r.edit.path}\` : ${r.edit.summary.charAt(0).toLowerCase()}${r.edit.summary.slice(1)} Corrigé.\n\n**Vérification**\n- \`${r.test.command}\` → OK\n- \`${r.typecheck.command}\` → aucune erreur`,
    },
  ];
}

/** Later prompts in the same live session: a short, prompt-agnostic answer. */
export function followUpScript(projectId: string): ReplayStep[] {
  const r = replayFor(projectId);
  return [
    { kind: "turn", inputTokens: 26_800 },
    { kind: "thinking", text: "La demande prolonge le travail précédent ; je relis l'état actuel du fichier modifié." },
    { kind: "file-read", path: r.edit.path, line: r.edit.line },
    {
      kind: "message",
      text: `J'ai relu \`${r.edit.path}\` : le changement précédent couvre déjà ce point et je n'ai rien modifié de plus.\n\nDites-moi si vous voulez que j'aille plus loin (tests supplémentaires, refactoring).`,
    },
  ];
}
