import { AlertTriangle, ArrowLeftRight, ExternalLink, History, MessagesSquare } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HarnessBadge, ModelLabel, SessionStatusBadge } from "@/components/warden/badges";
import { DiffStat } from "@/components/warden/diff-view";
import { Markdown } from "@/components/warden/markdown";
import { ObservedValue } from "@/components/warden/observation";
import { Page, Section } from "@/components/warden/page";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { CONFIDENCE_LABELS } from "@/lib/labels";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import { allSessionsNewestFirst, getHarness, getSession, getTrace } from "@/mock/queries";
import type { Observation, Session, TraceEvent } from "@/mock/types";
import { METRIC_DEFS, type MetricDef, TRACE_STAT_LABELS, type TraceStats, timeBreakdown, traceStats } from "./analysis";
import { Banner, VariablesSection } from "./compare-variables";
import { FileLink, TimeBreakdownBars } from "./observe-ui";

const DEFAULT_A = "s-atlas-101";
const DEFAULT_B = "s-atlas-102";

/** Closest comparable session: same project and workload first (CDC §20: keep the other variables constant). */
function defaultPartner(a: Session, all: Session[]): Session {
  const others = all.filter((s) => s.id !== a.id);
  return (
    others.find((s) => s.projectId === a.projectId && s.workload === a.workload) ??
    others.find((s) => s.projectId === a.projectId) ??
    others[0]
  );
}

/** CDC §19–§20 — two sessions side by side, with differing variables made explicit. */
export function CompareScreen() {
  const [params, setParams] = useSearchParams();
  const all = allSessionsNewestFirst();
  const aParam = params.get("a");
  const bParam = params.get("b");
  const a = (aParam && getSession(aParam)) || (getSession(DEFAULT_A) as Session);
  const b = (bParam && getSession(bParam)) || (aParam ? defaultPartner(a, all) : (getSession(DEFAULT_B) as Session));
  const traceA = getTrace(a.id);
  const traceB = getTrace(b.id);

  const pick = (side: "a" | "b", id: string) =>
    setParams({ a: side === "a" ? id : a.id, b: side === "b" ? id : b.id }, { replace: true });

  return (
    <Page
      title="Comparer deux sessions"
      subtitle="Une seule variable doit changer pour pouvoir attribuer un écart (CDC §20)."
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to={links.history()}>
            <History />
            Historique
          </Link>
        </Button>
      }
    >
      <div className="space-y-8">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          <SessionColumnHeader side="A" session={a} all={all} onPick={(id) => pick("a", id)} />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setParams({ a: b.id, b: a.id }, { replace: true })}
            aria-label="Inverser A et B"
            title="Inverser A et B"
          >
            <ArrowLeftRight />
          </Button>
          <SessionColumnHeader side="B" session={b} all={all} onPick={(id) => pick("b", id)} />
        </div>

        {a.id === b.id ? (
          <Banner tone="warning">Sélectionnez deux sessions différentes.</Banner>
        ) : (
          <>
            <VariablesSection a={a} b={b} traceA={traceA} traceB={traceB} />
            <MetricsSection a={a} b={b} />
            <Section title="Où est passé le temps">
              <div className="grid gap-3 lg:grid-cols-2">
                {[
                  { side: "A", session: a, trace: traceA },
                  { side: "B", session: b, trace: traceB },
                ].map((col) => (
                  <div key={col.side} className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-3 text-xs font-medium text-muted-foreground">Session {col.side}</div>
                    <TimeBreakdownBars breakdown={timeBreakdown(col.session, col.trace)} dense />
                  </div>
                ))}
              </div>
            </Section>
            <TraceStatsSection a={traceStats(traceA)} b={traceStats(traceB)} />
            <FilesSection a={a} b={b} />
            <AnswersSection traceA={traceA} traceB={traceB} />
          </>
        )}
      </div>
    </Page>
  );
}

function SessionColumnHeader({
  side,
  session,
  all,
  onPick,
}: {
  side: "A" | "B";
  session: Session;
  all: Session[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/15 font-mono text-xs font-semibold text-primary">
          {side}
        </span>
        <Select value={session.id} onValueChange={onPick}>
          <SelectTrigger size="sm" className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {all.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="truncate">{s.title}</span>
                <span className="text-xs text-muted-foreground">· {getHarness(s.harnessId).name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-7 text-xs text-muted-foreground">
        <SessionStatusBadge status={session.status} />
        <HarnessBadge harnessId={session.harnessId} />
        <ModelLabel providerId={session.providerId} modelId={session.modelId} />
        <span>{formatDateTime(session.startedAt)}</span>
        <Link to={links.observeSession(session.id)} className="inline-flex items-center gap-1 hover:text-primary">
          <ExternalLink className="size-3" />
          Observer
        </Link>
        <Link
          to={links.session(session.projectId, session.id)}
          className="inline-flex items-center gap-1 hover:text-primary"
        >
          <MessagesSquare className="size-3" />
          Conversation
        </Link>
      </div>
    </div>
  );
}

// ── Metrics ────────────────────────────────────────────────────────────────

function MetricsSection({ a, b }: { a: Session; b: Session }) {
  return (
    <Section title="Métriques">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Métrique</TableHead>
              <TableHead className="text-right">Session A</TableHead>
              <TableHead className="text-right">Session B</TableHead>
              <TableHead className="text-right">Écart (B − A)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {METRIC_DEFS.map((m) => (
              <TableRow key={m.key}>
                <TableCell className="text-muted-foreground">{m.label}</TableCell>
                <TableCell className="text-right">
                  <ObservedValue obs={a.metrics[m.key]} format={m.format} className="justify-end" />
                </TableCell>
                <TableCell className="text-right">
                  <ObservedValue obs={b.metrics[m.key]} format={m.format} className="justify-end" />
                </TableCell>
                <TableCell className="text-right">
                  <MetricDelta def={m} a={a.metrics[m.key]} b={b.metrics[m.key]} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Un écart n'est calculé que si les deux valeurs sont connues. Lorsque les niveaux de confiance diffèrent (par ex.
        coût Estimated contre Observed), l'écart est indicatif.
      </p>
    </Section>
  );
}

function MetricDelta({ def, a, b }: { def: MetricDef; a: Observation<number>; b: Observation<number> }) {
  if (a.value === null || b.value === null) {
    const missing = [a.value === null && "A", b.value === null && "B"].filter(Boolean).join(" et ");
    return (
      <span className="text-xs text-muted-foreground" title={`Valeur Unavailable pour ${missing}`}>
        non comparable
      </span>
    );
  }
  const diff = b.value - a.value;
  const mixed = a.confidence !== b.confidence;
  const approximate = mixed || a.confidence !== "observed" || b.confidence !== "observed";
  const tone = diff === 0 || !def.lowerIsBetter ? "text-foreground" : diff < 0 ? "text-success" : "text-destructive";
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      {mixed && (
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertTriangle className="size-3.5 text-warning" aria-label="Niveaux de confiance différents" />
          </TooltipTrigger>
          <TooltipContent>
            Confiance différente : {CONFIDENCE_LABELS[a.confidence]} (A) contre {CONFIDENCE_LABELS[b.confidence]} (B).
            Écart indicatif.
          </TooltipContent>
        </Tooltip>
      )}
      <span className={cn("tabular-nums", tone, approximate && "italic")}>
        {approximate && "≈ "}
        {diff === 0 ? "=" : `${diff > 0 ? "+" : "−"}${def.format(Math.abs(diff))}`}
      </span>
      {diff !== 0 && a.value !== 0 && (
        <span className="w-12 text-xs text-muted-foreground tabular-nums">
          {diff > 0 ? "+" : "−"}
          {formatPercent(Math.abs(diff) / a.value)}
        </span>
      )}
    </span>
  );
}

// ── Trace stats ────────────────────────────────────────────────────────────

function TraceStatsSection({ a, b }: { a: TraceStats; b: TraceStats }) {
  const keys = Object.keys(TRACE_STAT_LABELS) as (keyof TraceStats)[];
  return (
    <Section title="Traces">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Événements</TableHead>
              <TableHead className="text-right">Session A</TableHead>
              <TableHead className="text-right">Session B</TableHead>
              <TableHead className="text-right">Écart (B − A)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((key) => {
              const diff = b[key] - a[key];
              return (
                <TableRow key={key}>
                  <TableCell className="text-muted-foreground">{TRACE_STAT_LABELS[key]}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(a[key])}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(b[key])}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", diff === 0 && "text-muted-foreground")}>
                    {diff === 0 ? "=" : `${diff > 0 ? "+" : "−"}${formatNumber(Math.abs(diff))}`}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Décomptés dans les traces conservées par Warden ; ils peuvent différer des métriques rapportées par le harness
        lorsque la trace est partielle.
      </p>
    </Section>
  );
}

// ── Files ──────────────────────────────────────────────────────────────────

function FilesSection({ a, b }: { a: Session; b: Session }) {
  const pathsA = a.filesChanged.map((f) => f.path);
  const pathsB = b.filesChanged.map((f) => f.path);
  return (
    <Section title="Fichiers modifiés">
      <div className="grid gap-3 lg:grid-cols-2">
        {[
          { side: "A", session: a, other: pathsB },
          { side: "B", session: b, other: pathsA },
        ].map((col) => (
          <div key={col.side} className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
              Session {col.side} · {col.session.filesChanged.length} fichier(s)
            </div>
            {col.session.filesChanged.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">Aucun fichier modifié.</div>
            ) : (
              <ul className="divide-y divide-border">
                {col.session.filesChanged.map((f) => (
                  <li key={f.path} className="flex items-center gap-3 px-3 py-2">
                    <FileLink
                      projectId={col.session.projectId}
                      sessionId={col.session.id}
                      file={{ path: f.path }}
                      view="diff"
                      className="flex-1"
                    />
                    <span
                      className={cn(
                        "text-[11px]",
                        col.other.includes(f.path) ? "text-muted-foreground" : "text-warning",
                      )}
                    >
                      {col.other.includes(f.path) ? "dans les deux" : `uniquement ${col.side}`}
                    </span>
                    <DiffStat additions={f.additions} deletions={f.deletions} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Answers ────────────────────────────────────────────────────────────────

function AnswersSection({ traceA, traceB }: { traceA: TraceEvent[]; traceB: TraceEvent[] }) {
  return (
    <Section title="Réponse finale de l'agent">
      <div className="grid gap-3 lg:grid-cols-2">
        {[
          { side: "A", trace: traceA },
          { side: "B", trace: traceB },
        ].map((col) => {
          const answer = [...col.trace].reverse().find((e) => e.kind === "assistant-message");
          return (
            <div key={col.side} className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">Session {col.side}</div>
              <div className="max-h-64 overflow-auto px-3 py-2 text-sm">
                {answer?.text ? (
                  <Markdown>{answer.text}</Markdown>
                ) : (
                  <span className="text-muted-foreground">Aucune réponse finale.</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
