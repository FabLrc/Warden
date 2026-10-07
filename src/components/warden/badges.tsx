import { AlertTriangle, Check, CircleHelp, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SESSION_STATUS_LABELS, SUPPORT_LABELS, WORKLOAD_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { CompatibilityStatus, CompatibilityVerdict } from "@/mock/queries";
import { getHarness, getModel, getProvider } from "@/mock/queries";
import type { HarnessId, HarnessStatus, SessionStatus, Support, Workload } from "@/mock/types";

const HARNESS_STATUS_DOT: Record<HarnessStatus, string> = {
  available: "bg-success",
  outdated: "bg-warning",
  "not-installed": "bg-muted-foreground/50",
  error: "bg-destructive",
};

/** Harness name with an availability dot. */
export function HarnessBadge({ harnessId, className }: { harnessId: HarnessId; className?: string }) {
  const h = getHarness(harnessId);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-2 text-xs font-medium",
        className,
      )}
      title={h.statusDetail ?? `${h.name} ${h.version ?? ""}`}
    >
      <span className={cn("size-1.5 rounded-full", HARNESS_STATUS_DOT[h.status])} />
      {h.name}
    </span>
  );
}

/** "Anthropic / Claude Sonnet" — provider and model kept distinct (CDC §11). */
export function ModelLabel({
  providerId,
  modelId,
  className,
}: {
  providerId: string;
  modelId: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", className)}>
      <span className="text-muted-foreground">{getProvider(providerId).name} /</span>
      <span className="font-medium">{getModel(modelId).name}</span>
    </span>
  );
}

const SUPPORT_META: Record<Support | CompatibilityStatus, { icon: typeof Check; cls: string }> = {
  supported: { icon: Check, cls: "text-success border-success/35 bg-success/10" },
  partial: { icon: AlertTriangle, cls: "text-warning border-warning/35 bg-warning/10" },
  unsupported: { icon: X, cls: "text-destructive border-destructive/35 bg-destructive/10" },
  unknown: { icon: CircleHelp, cls: "text-muted-foreground border-border bg-muted/40" },
};

/** Capability / compatibility support with an optional explanatory note. */
export function SupportBadge({
  support,
  note,
  label,
  compact = false,
  className,
}: {
  support: Support;
  note?: string;
  /** Overrides the default label. */
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const { icon: Icon, cls } = SUPPORT_META[support];
  const badge = (
    <span
      className={cn("inline-flex h-5 items-center gap-1 rounded border px-1.5 text-[11px] font-medium", cls, className)}
    >
      <Icon className="size-3" />
      {!compact && (label ?? SUPPORT_LABELS[support])}
    </span>
  );
  if (!note && !compact) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>{note ?? label ?? SUPPORT_LABELS[support]}</TooltipContent>
    </Tooltip>
  );
}

export function CompatBadge({ verdict, compact }: { verdict: CompatibilityVerdict; compact?: boolean }) {
  return <SupportBadge support={verdict.status} note={verdict.reason} compact={compact} />;
}

const SESSION_STATUS_CLASSES: Record<SessionStatus, string> = {
  running: "text-primary border-primary/40 bg-primary/10",
  "awaiting-permission": "text-warning border-warning/40 bg-warning/10",
  completed: "text-success border-success/35 bg-success/10",
  interrupted: "text-muted-foreground border-border bg-muted/40",
  failed: "text-destructive border-destructive/35 bg-destructive/10",
};

export function SessionStatusBadge({ status, className }: { status: SessionStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded border px-1.5 text-[11px] font-medium",
        SESSION_STATUS_CLASSES[status],
        className,
      )}
    >
      {status === "running" && <span className="size-1.5 animate-soul rounded-full bg-primary" />}
      {SESSION_STATUS_LABELS[status]}
    </span>
  );
}

/** Small status dot for dense lists. */
export function SessionStatusDot({ status }: { status: SessionStatus }) {
  const color: Record<SessionStatus, string> = {
    running: "bg-primary animate-soul",
    "awaiting-permission": "bg-warning animate-soul",
    completed: "bg-success",
    interrupted: "bg-muted-foreground/60",
    failed: "bg-destructive",
  };
  return <span className={cn("size-1.5 shrink-0 rounded-full", color[status])} title={SESSION_STATUS_LABELS[status]} />;
}

export function WorkloadBadge({ workload }: { workload: Workload }) {
  return (
    <span className="inline-flex h-5 items-center rounded border border-border px-1.5 text-[11px] text-muted-foreground">
      {WORKLOAD_LABELS[workload]}
    </span>
  );
}
