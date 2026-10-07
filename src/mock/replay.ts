import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { PERMISSION_KIND_LABELS } from "@/lib/labels";
import { MOCK_NOW } from "@/mock/fixtures/catalog";
import { followUpScript, type ReplayStep, replayScript } from "@/mock/fixtures/replay";
import { metricsFor } from "@/mock/fixtures/sessions";
import { getAgent, getHarness, getModel } from "@/mock/queries";
import type {
  HarnessId,
  Observation,
  PermissionDecision,
  PermissionKind,
  PermissionPolicyValue,
  SessionMetrics,
  TraceEvent,
  TraceEventKind,
  TraceEventStatus,
} from "@/mock/types";

/**
 * Scripted streaming replay standing in for a live harness (prototype only).
 * A small timer-driven engine outside React, exposed through `useReplay`.
 */

/** A trace event plus an optional Warden note (e.g. why a permission was granted automatically). */
export type ReplayEvent = TraceEvent & { note?: string };

export type ReplayStatus = "idle" | "running" | "awaiting-permission" | "completed" | "interrupted";

export interface ReplayConfig {
  projectId: string;
  harnessId: HarnessId;
  providerId: string;
  modelId: string;
  agentId?: string;
  /** The live run continues an existing harness session (session/load). */
  resumed?: boolean;
}

type GatedStep = Extract<ReplayStep, { kind: "file-edit" | "command" }>;

export interface PendingPermission {
  eventId: string;
  kind: PermissionKind;
  command?: string;
  file?: { path: string; line?: number };
  reason: string;
}

export interface ReplaySnapshot {
  status: ReplayStatus;
  events: ReplayEvent[];
  pending: PendingPermission | null;
  elapsedMs: number;
  /** Tokens as the harness reports them (live, per turn, or never). */
  reportedTokens: { input: number; output: number } | null;
  config: ReplayConfig | null;
}

/** Used when no agent is selected: sensitive actions are always asked. */
const DEFAULT_POLICY: Record<PermissionKind, PermissionPolicyValue> = {
  read: "allow",
  write: "ask",
  shell: "ask",
  network: "ask",
  git: "ask",
  external: "ask",
  dangerous: "ask",
};

const TOOL_KINDS: Partial<Record<TraceEventKind, true>> = {
  "file-read": true,
  "file-edit": true,
  command: true,
  "tool-call": true,
};

const perCallUnavailable: Observation<number> = {
  value: null,
  confidence: "unavailable",
  note: "Pas de détail par appel via ACP",
};

const approxTokens = (text: string): number => Math.max(1, Math.ceil(text.length / 4));

class ReplayEngine {
  private snapshot: ReplaySnapshot = {
    status: "idle",
    events: [],
    pending: null,
    elapsedMs: 0,
    reportedTokens: null,
    config: null,
  };
  private listeners = new Set<() => void>();
  private queue: ReplayStep[] = [];
  private timer: number | undefined;
  private ticker: number | undefined;
  private seq = 0;
  private prompts = 0;
  private turnCount = 0;
  private turn: { id: string; startedAt: number; input: number; output: number } | null = null;
  private trueTokens = { input: 0, output: 0 };
  private activeBaseMs = 0;
  private segmentStart = 0;
  private alwaysAllowed = new Set<PermissionKind>();
  private pendingStep: GatedStep | null = null;
  private pendingSince = 0;

  constructor(private readonly baseId: string) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  /** Stops timers (unmount). The engine can be used again afterwards. */
  dispose = () => {
    clearTimeout(this.timer);
    clearInterval(this.ticker);
    this.timer = undefined;
    this.ticker = undefined;
  };

  send = (prompt: string, config: ReplayConfig) => {
    const { status } = this.snapshot;
    if (status === "running" || status === "awaiting-permission") return;
    const cfg = this.snapshot.config ?? config;
    const harness = getHarness(cfg.harnessId);
    this.set({ config: cfg, status: "running" });
    this.startClock();
    if (this.prompts === 0) {
      this.push({
        kind: "session-start",
        title: cfg.resumed
          ? `Session reprise · ${harness.name} (session/load)`
          : `Session démarrée · ${harness.name} · ${getModel(cfg.modelId).name}`,
        status: "ok",
        raw: { jsonrpc: "2.0", method: cfg.resumed ? "session/load" : "session/new", params: { cwd: "<project>" } },
      });
    }
    this.push({
      kind: "user-prompt",
      title: "Prompt",
      text: prompt,
      raw: { jsonrpc: "2.0", method: "session/prompt", params: { prompt: [{ type: "text", text: prompt }] } },
    });
    this.queue = this.prompts === 0 ? replayScript(cfg.projectId) : followUpScript(cfg.projectId);
    this.prompts += 1;
    this.schedule(500);
  };

  answer = (decision: PermissionDecision) => {
    const pending = this.snapshot.pending;
    const step = this.pendingStep;
    if (!pending || !step) return;
    this.update(pending.eventId, {
      status: decision === "deny" ? "denied" : "ok",
      permission: { kind: pending.kind, decision, reason: pending.reason },
      durationMs: Date.now() - this.pendingSince,
    });
    this.pendingStep = null;
    this.set({ pending: null, status: "running" });
    if (decision === "allow-always") this.alwaysAllowed.add(pending.kind);
    if (decision === "deny") {
      this.queue = step.onDenied;
      this.schedule(600);
    } else {
      this.runTool(step);
    }
  };

  interrupt = () => {
    const { status } = this.snapshot;
    if (status !== "running" && status !== "awaiting-permission") return;
    clearTimeout(this.timer);
    this.queue = [];
    this.pendingStep = null;
    this.set({
      events: this.snapshot.events.map(
        (e): ReplayEvent => (e.status === "pending" ? { ...e, status: "cancelled" } : e),
      ),
      pending: null,
    });
    this.closeTurn("cancelled");
    this.push({
      kind: "interrupt",
      title: "Session interrompue par l'utilisateur",
      status: "cancelled",
      raw: { jsonrpc: "2.0", method: "session/cancel", params: {} },
    });
    this.stopClock();
    this.set({ status: "interrupted" });
  };

  // ── Internals ────────────────────────────────────────────────────────────

  private get config(): ReplayConfig {
    const cfg = this.snapshot.config;
    if (!cfg) throw new Error("Replay not started");
    return cfg;
  }

  private set(patch: Partial<ReplaySnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  private now(): number {
    return this.activeBaseMs + (this.ticker ? Date.now() - this.segmentStart : 0);
  }

  private startClock() {
    if (this.ticker) return;
    this.segmentStart = Date.now();
    this.ticker = window.setInterval(() => this.set({ elapsedMs: this.now() }), 200);
  }

  private stopClock() {
    this.activeBaseMs = this.now();
    clearInterval(this.ticker);
    this.ticker = undefined;
    this.set({ elapsedMs: this.activeBaseMs });
  }

  private schedule(ms: number, fn: () => void = this.next) {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(fn, ms);
  }

  private push(event: Omit<ReplayEvent, "id" | "sessionId" | "at">): string {
    this.seq += 1;
    const id = `${this.baseId}:live-${this.seq}`;
    const at = new Date(MOCK_NOW.getTime() + this.now()).toISOString();
    this.set({ events: [...this.snapshot.events, { ...event, id, sessionId: this.baseId, at }] });
    return id;
  }

  private update(id: string, patch: Partial<ReplayEvent>) {
    this.set({ events: this.snapshot.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  }

  private addOutputTokens(n: number) {
    this.trueTokens.output += n;
    if (this.turn) this.turn.output += n;
    if (getHarness(this.config.harnessId).capabilities.tokenUsage.support === "supported") {
      this.set({ reportedTokens: { ...this.trueTokens } });
    }
  }

  private closeTurn(status: TraceEventStatus) {
    const turn = this.turn;
    if (!turn) return;
    this.turn = null;
    const usage = getHarness(this.config.harnessId).capabilities.tokenUsage.support;
    const perCall = usage === "supported";
    this.update(turn.id, {
      status,
      durationMs: Date.now() - turn.startedAt,
      tokens: perCall
        ? {
            input: { value: turn.input, confidence: "observed", source: "usage par appel" },
            output: { value: turn.output, confidence: "observed", source: "usage par appel" },
          }
        : { input: perCallUnavailable, output: perCallUnavailable },
    });
    // "partial" harnesses (e.g. OpenCode) only report a total at the end of each turn.
    if (usage === "partial") this.set({ reportedTokens: { ...this.trueTokens } });
  }

  private finish() {
    this.closeTurn("ok");
    this.stopClock();
    this.set({ status: "completed" });
  }

  private next = () => {
    const step = this.queue.shift();
    if (!step) {
      this.finish();
      return;
    }
    switch (step.kind) {
      case "turn": {
        this.closeTurn("ok");
        this.turnCount += 1;
        this.trueTokens.input += step.inputTokens;
        const id = this.push({
          kind: "model-call",
          title: `Appel modèle #${this.turnCount}`,
          status: "pending",
          raw: { _warden: "inferred", note: "Appel modèle déduit des frontières entre messages ACP." },
        });
        this.turn = { id, startedAt: Date.now(), input: step.inputTokens, output: 0 };
        if (getHarness(this.config.harnessId).capabilities.tokenUsage.support === "supported") {
          this.set({ reportedTokens: { ...this.trueTokens } });
        }
        this.schedule(700);
        return;
      }
      case "thinking":
        this.push({
          kind: "thinking",
          parentId: this.turn?.id,
          title: "Réflexion",
          text: step.text,
          raw: acpUpdate({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: step.text } }),
        });
        this.addOutputTokens(approxTokens(step.text));
        this.schedule(1_100);
        return;
      case "message":
        this.streamMessage(step.text);
        return;
      case "file-read": {
        const title = `Lire ${step.path}${step.line ? `:${step.line}` : ""}`;
        const id = this.push({
          kind: "file-read",
          parentId: this.turn?.id,
          title,
          tool: "read",
          status: "pending",
          file: { path: step.path, line: step.line },
          raw: acpToolCall(title, "read", "in_progress"),
        });
        this.addOutputTokens(40);
        this.schedule(550, () => {
          this.update(id, { status: "ok", durationMs: 35 });
          this.schedule(250);
        });
        return;
      }
      case "search": {
        const id = this.push({
          kind: "tool-call",
          parentId: this.turn?.id,
          title: step.title,
          tool: "grep",
          status: "pending",
          command: step.command,
          raw: acpToolCall(step.title, "search", "in_progress"),
        });
        this.addOutputTokens(60);
        this.schedule(750, () => {
          this.update(id, { status: "ok", durationMs: 110, output: step.output });
          this.schedule(300);
        });
        return;
      }
      case "file-edit":
      case "command":
        this.gate(step);
        return;
    }
  };

  private streamMessage(text: string) {
    const id = this.push({
      kind: "assistant-message",
      parentId: this.turn?.id,
      title: "Message",
      text: "",
      raw: acpUpdate({ sessionUpdate: "agent_message_chunk", content: { type: "text", text } }),
    });
    const chunks = text.match(/\S+\s*/g) ?? [text];
    let i = 0;
    const tick = () => {
      const chunk = chunks.slice(i, i + 3).join("");
      i += 3;
      const current = this.snapshot.events.find((e) => e.id === id);
      this.update(id, { text: `${current?.text ?? ""}${chunk}` });
      this.addOutputTokens(approxTokens(chunk));
      if (i < chunks.length) this.schedule(55, tick);
      else this.schedule(450);
    };
    this.schedule(120, tick);
  }

  private gate(step: GatedStep) {
    const kind: PermissionKind = step.kind === "file-edit" ? "write" : step.permission;
    const label = PERMISSION_KIND_LABELS[kind];
    const harness = getHarness(this.config.harnessId);
    const agent = this.config.agentId ? getAgent(this.config.agentId) : undefined;
    const policy = agent?.permissions[kind] ?? DEFAULT_POLICY[kind];
    // A harness with partial permission support only lets Warden intercept shell commands (e.g. Pi).
    const intercepted = harness.capabilities.permissions.support === "supported" || kind === "shell";
    const target =
      step.kind === "file-edit" ? { file: { path: step.path, line: step.line } } : { command: step.command };
    const title = step.kind === "file-edit" ? `Modifier ${step.path}` : `Exécuter : ${step.command}`;

    if (!intercepted) {
      this.runTool(
        step,
        `${harness.name} n'expose pas de demande de permission pour ce type d'action (${label}) : exécutée sans confirmation.`,
      );
    } else if (policy === "allow") {
      this.runTool(
        step,
        `Autorisé automatiquement : politique de l'agent ${agent?.name ?? ""} (${label} = Autoriser).`,
      );
    } else if (policy === "deny") {
      this.push({
        kind: "permission-request",
        parentId: this.turn?.id,
        title,
        status: "denied",
        ...target,
        permission: { kind, decision: "deny", reason: step.reason },
        note: `Refusé automatiquement : politique de l'agent ${agent?.name ?? ""} (${label} = Refuser).`,
        raw: acpPermission(title),
      });
      this.queue = step.onDenied;
      this.schedule(800);
    } else if (this.alwaysAllowed.has(kind)) {
      this.runTool(step, `Autorisé : « Toujours autoriser » (${label}) a été choisi plus tôt dans cette session.`);
    } else {
      const eventId = this.push({
        kind: "permission-request",
        parentId: this.turn?.id,
        title,
        status: "pending",
        ...target,
        permission: { kind, reason: step.reason },
        raw: acpPermission(title),
      });
      this.pendingStep = step;
      this.pendingSince = Date.now();
      this.set({ status: "awaiting-permission", pending: { eventId, kind, reason: step.reason, ...target } });
    }
  }

  private runTool(step: GatedStep, note?: string) {
    this.addOutputTokens(150);
    if (step.kind === "file-edit") {
      const title = `Modifier ${step.path}`;
      const id = this.push({
        kind: "file-edit",
        parentId: this.turn?.id,
        title,
        tool: "edit",
        status: "pending",
        file: { path: step.path, line: step.line },
        diff: step.diff,
        note,
        raw: acpToolCall(title, "edit", "in_progress"),
      });
      this.schedule(650, () => {
        this.update(id, { status: "ok", durationMs: 60 });
        this.schedule(400);
      });
      return;
    }
    const id = this.push({
      kind: "command",
      parentId: this.turn?.id,
      title: step.command,
      tool: "shell",
      status: "pending",
      command: step.command,
      note,
      raw: acpToolCall(step.command, "execute", "in_progress"),
    });
    this.schedule(step.durationMs, () => {
      this.update(id, {
        status: step.exitCode === 0 ? "ok" : "error",
        durationMs: step.durationMs,
        exitCode: step.exitCode,
        output: step.output,
      });
      this.schedule(450);
    });
  }
}

const acpUpdate = (update: Record<string, unknown>) => ({
  jsonrpc: "2.0",
  method: "session/update",
  params: { update },
});

const acpToolCall = (title: string, kind: string, status: string) =>
  acpUpdate({ sessionUpdate: "tool_call", title, kind, status });

const acpPermission = (title: string) => ({
  jsonrpc: "2.0",
  method: "session/request_permission",
  params: {
    toolCall: { title },
    options: [
      { optionId: "allow-once", kind: "allow_once", name: "Autoriser une fois" },
      { optionId: "allow-always", kind: "allow_always", name: "Toujours autoriser" },
      { optionId: "reject-once", kind: "reject_once", name: "Refuser" },
    ],
  },
});

/**
 * Metrics of the live run with the same confidence pattern as recorded sessions (CDC §17):
 * tokens are Unavailable until the harness reports them, cost is Estimated when the harness does not report it.
 */
export function liveMetrics(snapshot: ReplaySnapshot): SessionMetrics | null {
  const cfg = snapshot.config;
  if (!cfg) return null;
  const harness = getHarness(cfg.harnessId);
  const model = getModel(cfg.modelId);
  const count = (pred: (e: ReplayEvent) => boolean) => snapshot.events.filter(pred).length;
  const tokens = snapshot.reportedTokens;
  const cost =
    tokens && model.inputPricePerMTok !== undefined && model.outputPricePerMTok !== undefined
      ? (tokens.input * model.inputPricePerMTok + tokens.output * model.outputPricePerMTok) / 1_000_000
      : 0;
  const base = metricsFor(cfg.harnessId, {
    durationMin: snapshot.elapsedMs / 60_000,
    input: tokens?.input ?? 0,
    output: tokens?.output ?? 0,
    cache: 0,
    cost,
    modelCalls: count((e) => e.kind === "model-call"),
    toolCalls: count((e) => TOOL_KINDS[e.kind] === true),
    errors: count((e) => e.status === "error"),
    permissions: count((e) => e.kind === "permission-request"),
    systemPrompt: 0,
  });
  if (tokens) return base;
  const usage = harness.capabilities.tokenUsage;
  const missing: Observation<number> = {
    value: null,
    confidence: "unavailable",
    note:
      usage.support === "supported"
        ? "En attente du premier appel modèle"
        : usage.support === "partial"
          ? `${harness.name} rapporte l'usage en fin de tour uniquement`
          : `${harness.name} n'expose pas l'usage des tokens`,
  };
  return { ...base, inputTokens: missing, outputTokens: missing, cost: { ...missing, note: "Dépend des tokens" } };
}

export interface ReplayHandle extends ReplaySnapshot {
  metrics: SessionMetrics | null;
  /** Running or waiting for a permission answer. */
  active: boolean;
  send: (prompt: string, config: ReplayConfig) => void;
  answer: (decision: PermissionDecision) => void;
  interrupt: () => void;
}

/** Live scripted session. `baseId` prefixes event ids (existing session id, or a draft id). */
export function useReplay(baseId: string): ReplayHandle {
  const [engine] = useState(() => new ReplayEngine(baseId));
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  useEffect(() => engine.dispose, [engine]);
  const metrics = useMemo(() => liveMetrics(snapshot), [snapshot]);
  return {
    ...snapshot,
    metrics,
    active: snapshot.status === "running" || snapshot.status === "awaiting-permission",
    send: engine.send,
    answer: engine.answer,
    interrupt: engine.interrupt,
  };
}
