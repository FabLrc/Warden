import {
  Ban,
  Bot,
  Check,
  ChevronRight,
  CircleSlash,
  Cpu,
  ExternalLink,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DiffStat, DiffView } from "@/components/warden/diff-view";
import { Markdown } from "@/components/warden/markdown";
import { TRACE_KIND_META, TraceKindIcon } from "@/components/warden/trace-meta";
import { formatDuration, formatTime } from "@/lib/format";
import { PERMISSION_DECISION_LABELS, PERMISSION_KIND_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ReplayEvent } from "@/mock/replay";
import type { PermissionDecision, TraceEvent, TraceEventStatus } from "@/mock/types";

/** Where a conversation item links to; recorded and live events differ (live diffs are not in the fixtures). */
export interface ConversationLinks {
  code: (event: TraceEvent) => string;
  /** Detailed event view in Observe; undefined for events that are not recorded yet. */
  observe: (event: TraceEvent) => string | undefined;
}

/** "+N −M" counted from a unified diff. */
export function diffStat(diff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }
  return { additions, deletions };
}

type Block = { event: ReplayEvent; children: ReplayEvent[] };

/** Groups children under their model-call turn, keeping chronological order. */
function toBlocks(events: ReplayEvent[]): Block[] {
  const blocks: Block[] = [];
  const byId: Record<string, Block> = {};
  for (const event of events) {
    const parent = event.parentId ? byId[event.parentId] : undefined;
    if (parent) {
      parent.children.push(event);
      continue;
    }
    const block: Block = { event, children: [] };
    byId[event.id] = block;
    blocks.push(block);
  }
  return blocks;
}

export function Conversation({
  events,
  links,
  streaming,
  onPermission,
}: {
  events: ReplayEvent[];
  links: ConversationLinks;
  /** A live run is producing events: the last assistant message shows a caret. */
  streaming: boolean;
  /** Answer to the pending permission request (live run only). */
  onPermission?: (decision: PermissionDecision) => void;
}) {
  const lastId = events.at(-1)?.id;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {toBlocks(events).map(({ event, children }) => {
        switch (event.kind) {
          case "session-start":
          case "session-end":
            return <Divider key={event.id} event={event} />;
          case "interrupt":
            return <Divider key={event.id} event={event} tone="destructive" />;
          case "user-prompt":
            return <UserBubble key={event.id} event={event} />;
          case "model-call":
            return (
              <Turn key={event.id} event={event} observeHref={links.observe(event)}>
                {children.map((child) => (
                  <TurnItem
                    key={child.id}
                    event={child}
                    links={links}
                    caret={streaming && child.id === lastId}
                    onPermission={onPermission}
                  />
                ))}
              </Turn>
            );
          default:
            return (
              <TurnItem
                key={event.id}
                event={event}
                links={links}
                caret={streaming && event.id === lastId}
                onPermission={onPermission}
              />
            );
        }
      })}
    </div>
  );
}

function Divider({ event, tone }: { event: TraceEvent; tone?: "destructive" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-[11px] text-muted-foreground",
        tone === "destructive" && "text-destructive",
      )}
    >
      <span className="h-px flex-1 bg-border" />
      <TraceKindIcon kind={event.kind} className="size-3.5" />
      <span>{event.title}</span>
      <span className="tabular-nums opacity-70">{formatTime(event.at)}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function UserBubble({ event }: { event: TraceEvent }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="text-[11px] text-muted-foreground">
        Vous · <span className="tabular-nums">{formatTime(event.at)}</span>
      </div>
      <div className="max-w-[85%] rounded-lg rounded-tr-sm border border-border bg-secondary px-3.5 py-2.5 text-sm whitespace-pre-wrap text-bone">
        {event.text}
      </div>
    </div>
  );
}

function Turn({ event, observeHref, children }: { event: TraceEvent; observeHref?: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-primary">
        <Bot className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex h-7 items-center gap-2 text-[11px] text-muted-foreground">
          <Cpu className="size-3.5 text-chart-4" />
          <span>{event.title}</span>
          {event.status === "pending" ? (
            <span className="inline-flex items-center gap-1 text-primary">
              <Loader2 className="size-3 animate-spin" /> en cours
            </span>
          ) : (
            event.durationMs !== undefined && <span className="tabular-nums">{formatDuration(event.durationMs)}</span>
          )}
          {event.status === "cancelled" && <span className="text-destructive">annulé</span>}
          <span className="tabular-nums opacity-70">{formatTime(event.at)}</span>
          {observeHref && (
            <Link
              to={observeHref}
              className="ml-auto inline-flex items-center gap-1 hover:text-primary"
              title="Voir cet appel modèle dans Observe"
            >
              Trace <ExternalLink className="size-3" />
            </Link>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function TurnItem({
  event,
  links,
  caret,
  onPermission,
}: {
  event: ReplayEvent;
  links: ConversationLinks;
  caret: boolean;
  onPermission?: (decision: PermissionDecision) => void;
}) {
  switch (event.kind) {
    case "assistant-message":
      return <Markdown>{`${event.text ?? ""}${caret ? " ▍" : ""}`}</Markdown>;
    case "thinking":
      return <ThinkingBlock text={event.text ?? ""} />;
    case "permission-request":
      return event.status === "pending" && onPermission ? (
        <PermissionPrompt event={event} onAnswer={onPermission} />
      ) : (
        <PermissionRecord event={event} />
      );
    default:
      return <ToolCard event={event} links={links} />;
  }
}

function ThinkingBlock({ text }: { text: string }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group/think flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-3.5 transition-transform group-data-[state=open]/think:rotate-90" />
        <TraceKindIcon kind="thinking" className="size-3.5" />
        Réflexion
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-1.5 border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground italic">
          {text}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

const STATUS_ICON: Record<TraceEventStatus, { icon: typeof Check; cls: string; label: string }> = {
  pending: { icon: Loader2, cls: "animate-spin text-primary", label: "En cours" },
  ok: { icon: Check, cls: "text-success", label: "Terminé" },
  error: { icon: X, cls: "text-destructive", label: "Échec" },
  denied: { icon: Ban, cls: "text-warning", label: "Refusé" },
  cancelled: { icon: CircleSlash, cls: "text-muted-foreground", label: "Annulé" },
};

function StatusIcon({ status }: { status?: TraceEventStatus }) {
  if (!status) return null;
  const { icon: Icon, cls, label } = STATUS_ICON[status];
  return <Icon className={cn("size-3.5 shrink-0", cls)} aria-label={label} />;
}

/** Compact, collapsible card for a tool call (read, edit, command, generic tool, error). */
function ToolCard({ event, links }: { event: ReplayEvent; links: ConversationLinks }) {
  const hasBody = Boolean(event.diff || event.command || event.output);
  const isError = event.kind === "error" || event.status === "error";
  const stat = event.diff ? diffStat(event.diff) : undefined;
  const header = (
    <>
      <TraceKindIcon kind={event.kind} className="size-3.5" />
      <span className="shrink-0 text-[11px] text-muted-foreground">{TRACE_KIND_META[event.kind].label}</span>
      <span className="min-w-0 flex-1 truncate text-left font-mono text-xs">{event.title}</span>
    </>
  );
  return (
    <Collapsible
      defaultOpen={event.kind === "error"}
      className={cn(
        "rounded-md border bg-card/70",
        isError ? "border-destructive/40" : "border-border",
        event.status === "pending" && "border-primary/40",
      )}
    >
      <div className="flex h-8 items-center gap-2 px-2.5">
        {hasBody ? (
          <CollapsibleTrigger className="group/tool flex min-w-0 flex-1 items-center gap-2 text-left">
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/tool:rotate-90" />
            {header}
          </CollapsibleTrigger>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 pl-5.5">{header}</div>
        )}
        {stat && <DiffStat additions={stat.additions} deletions={stat.deletions} />}
        {event.exitCode !== undefined && (
          <span
            className={cn(
              "rounded border px-1 font-mono text-[10px]",
              event.exitCode === 0 ? "border-success/40 text-success" : "border-destructive/40 text-destructive",
            )}
          >
            exit {event.exitCode}
          </span>
        )}
        {event.durationMs !== undefined && event.status !== "pending" && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{formatDuration(event.durationMs)}</span>
        )}
        {event.file && (
          <Button variant="ghost" size="icon-xs" asChild>
            <Link
              to={links.code(event)}
              title={event.kind === "file-edit" ? "Voir le diff dans Code" : "Ouvrir le fichier dans Code"}
              aria-label="Ouvrir dans Code"
            >
              <ExternalLink />
            </Link>
          </Button>
        )}
        <StatusIcon status={event.status} />
      </div>
      {event.note && (
        <div className="flex items-start gap-1.5 border-t border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-px size-3.5 shrink-0 text-info" />
          {event.note}
        </div>
      )}
      {hasBody && (
        <CollapsibleContent className="border-t border-border/60 p-2.5">
          {event.diff ? (
            <DiffView diff={event.diff} highlightLine={event.file?.line} className="max-h-80" />
          ) : (
            <pre
              className={cn(
                "max-h-72 overflow-auto rounded-md border border-border bg-surface p-2.5 font-mono text-xs whitespace-pre-wrap",
                isError && "text-destructive",
              )}
            >
              {event.command && <span className="text-soul">$ {event.command}</span>}
              {event.command && event.output ? "\n" : ""}
              {event.output ?? (event.status === "pending" ? "" : event.command ? "(aucune sortie)" : "")}
            </pre>
          )}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

const DECISION_CLASSES: Record<PermissionDecision, string> = {
  "allow-once": "border-success/40 bg-success/10 text-success",
  "allow-always": "border-primary/40 bg-primary/10 text-primary",
  deny: "border-destructive/40 bg-destructive/10 text-destructive",
};

function PermissionTarget({ event }: { event: TraceEvent }) {
  if (event.command) return <code className="font-mono text-xs text-foreground">{event.command}</code>;
  if (event.file) return <code className="font-mono text-xs text-foreground">{event.file.path}</code>;
  return <span className="text-xs">{event.title}</span>;
}

/** A permission request that has been answered (or cancelled), showing the decision taken. */
function PermissionRecord({ event }: { event: ReplayEvent }) {
  const decision = event.permission?.decision;
  return (
    <div className="rounded-md border border-warning/25 bg-warning/5 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <TraceKindIcon kind="permission-request" className="size-3.5" />
        <span className="text-[11px] text-muted-foreground">
          Permission · {event.permission ? PERMISSION_KIND_LABELS[event.permission.kind] : "—"}
        </span>
        <span className="min-w-0 flex-1 truncate">
          <PermissionTarget event={event} />
        </span>
        {decision ? (
          <span className={cn("rounded border px-1.5 text-[11px] font-medium", DECISION_CLASSES[decision])}>
            {PERMISSION_DECISION_LABELS[decision]}
          </span>
        ) : (
          <span className="rounded border border-border px-1.5 text-[11px] text-muted-foreground">
            {event.status === "cancelled" ? "Annulée (interruption)" : "Sans réponse"}
          </span>
        )}
        {event.durationMs !== undefined && (
          <span className="text-[11px] text-muted-foreground tabular-nums" title="Temps d'attente de la réponse">
            {formatDuration(event.durationMs)}
          </span>
        )}
      </div>
      {event.permission?.reason && (
        <p className="mt-1 pl-5.5 text-xs text-muted-foreground">{event.permission.reason}</p>
      )}
      {event.note && <p className="mt-1 pl-5.5 text-[11px] text-warning">{event.note}</p>}
    </div>
  );
}

/** Inline permission prompt: the live run is paused until the user answers (CDC §30). */
function PermissionPrompt({
  event,
  onAnswer,
}: {
  event: ReplayEvent;
  onAnswer: (decision: PermissionDecision) => void;
}) {
  const kind = event.permission?.kind;
  return (
    <div className="glow-soul rounded-lg border border-warning/50 bg-card p-3.5" aria-live="polite">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-4 text-warning" />
        <span className="text-sm font-medium">L'agent demande une autorisation</span>
        {kind && (
          <span className="rounded border border-warning/40 bg-warning/10 px-1.5 text-[11px] font-medium text-warning">
            {PERMISSION_KIND_LABELS[kind]}
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">Session en pause</span>
      </div>
      <pre className="mt-2.5 overflow-auto rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs whitespace-pre-wrap text-foreground">
        {event.command ? `$ ${event.command}` : event.title}
      </pre>
      {event.permission?.reason && <p className="mt-2 text-xs text-muted-foreground">{event.permission.reason}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => onAnswer("allow-once")}>
          Autoriser une fois
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAnswer("allow-always")}>
          Toujours autoriser
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onAnswer("deny")}>
          Refuser
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          « Toujours » : toutes les actions {kind ? PERMISSION_KIND_LABELS[kind] : ""} de cette session
        </span>
      </div>
    </div>
  );
}
