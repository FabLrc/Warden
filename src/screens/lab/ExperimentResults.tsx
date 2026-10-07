import { AlertTriangle, Check, ExternalLink, X } from "lucide-react";
import { Link } from "react-router";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ObservedValue } from "@/components/warden/observation";
import { Section } from "@/components/warden/page";
import { formatCost, formatDuration, formatNumber, formatPercent, formatTokens } from "@/lib/format";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import type { Experiment, LabConfiguration, Observation } from "@/mock/types";
import { Delta, RUN_STATUS_META, RunDot, RunLegend } from "@/screens/lab/lab-meta";
import { type ConfigStats, configStats, LOW_SAMPLE_RUNS, relativeDelta, runTokens } from "@/screens/lab/lab-stats";

/** Per-configuration metrics, run grid and per-run detail of a finished experiment. */
export function ExperimentResults({ experiment: e }: { experiment: Experiment }) {
  const stats = e.configurations.map((c) => ({ config: c, stats: configStats(e, c.id) }));
  const lowSample = e.runsPerConfiguration < LOW_SAMPLE_RUNS;
  return (
    <>
      <Section title="Résultats par configuration" actions={<RunLegend />}>
        {lowSample && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/8 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Échantillon faible : {e.runsPerConfiguration} runs par configuration. Les écarts ci-dessous peuvent être dus
            au non-déterminisme ; relancez avec au moins {LOW_SAMPLE_RUNS} runs avant de conclure.
          </div>
        )}
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="pl-4">Configuration</TableHead>
                <TableHead>Réussite</TableHead>
                <TableHead>Runs</TableHead>
                <TableHead>Durée moy.</TableHead>
                <TableHead>Tokens moy.</TableHead>
                <TableHead>Coût moy.</TableHead>
                <TableHead>Tool calls moy.</TableHead>
                <TableHead>Interventions</TableHead>
                <TableHead className="pr-4">Variance entre runs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map(({ config, stats: s }) => (
                <TableRow key={config.id}>
                  <TableCell className="pl-4 font-medium">{config.label}</TableCell>
                  <TableCell>
                    <SuccessCell stats={s} />
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center">
                      {s.runs.map((r) => (
                        <RunDot key={r.id} run={r} checkers={e.checkers} />
                      ))}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ObservedValue obs={s.avgDuration} format={formatDuration} />
                  </TableCell>
                  <TableCell>
                    <ObservedValue obs={s.avgTokens} format={formatTokens} />
                  </TableCell>
                  <TableCell>
                    <ObservedValue obs={s.avgCost} format={formatCost} />
                  </TableCell>
                  <TableCell>
                    <ObservedValue
                      obs={s.avgToolCalls}
                      format={(v) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
                      hideBadge
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {s.avgInterventions === null
                      ? "—"
                      : s.avgInterventions.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
                  </TableCell>
                  <TableCell className="pr-4">
                    <VarianceCell stats={s} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {stats.length === 2 && <PairDelta a={stats[0]} b={stats[1]} />}
      </Section>
      <RunsTable experiment={e} />
    </>
  );
}

function SuccessCell({ stats: s }: { stats: ConfigStats }) {
  if (s.successRate === null) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="w-28">
      <div className="flex items-baseline justify-between text-sm tabular-nums">
        <span className="font-medium">{formatPercent(s.successRate)}</span>
        <span className="text-xs text-muted-foreground">
          {s.passed}/{s.finished}
        </span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-muted">
        <div className="h-full rounded-full bg-success" style={{ width: `${s.successRate * 100}%` }} />
      </div>
    </div>
  );
}

function VarianceCell({ stats: s }: { stats: ConfigStats }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block text-xs tabular-nums">
          <span>
            σ réussite{" "}
            {s.successStdDev === null ? "—" : s.successStdDev.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
          </span>
          <span className="block text-muted-foreground">
            durée ±{s.durationSpread === null ? "—" : formatPercent(s.durationSpread)}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-0.5">
        <span>σ réussite : écart-type du résultat réussi/échoué entre runs (0 = toujours le même résultat).</span>
        <span>Durée ± : dispersion des durées autour de la moyenne.</span>
      </TooltipContent>
    </Tooltip>
  );
}

type Arm = { config: LabConfiguration; stats: ConfigStats };

/** How the second configuration compares with the first (two-configuration experiments). */
function PairDelta({ a, b }: { a: Arm; b: Arm }) {
  const { stats: sa } = a;
  const { stats: sb } = b;
  const relative: { label: string; from: Observation<number>; to: Observation<number> }[] = [
    { label: "Durée", from: sa.avgDuration, to: sb.avgDuration },
    { label: "Tokens", from: sa.avgTokens, to: sb.avgTokens },
    { label: "Coût", from: sa.avgCost, to: sb.avgCost },
    { label: "Tool calls", from: sa.avgToolCalls, to: sb.avgToolCalls },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm">
      <span className="font-medium">
        {b.config.label} <span className="text-muted-foreground">vs</span> {a.config.label}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Réussite</span>
        <Delta
          value={sa.successRate === null || sb.successRate === null ? null : sb.successRate - sa.successRate}
          kind="points"
          betterWhen="higher"
        />
      </span>
      {relative.map((m) => (
        <span key={m.label} className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{m.label}</span>
          <Delta
            value={relativeDelta(m.from.value, m.to.value)}
            kind="percent"
            betterWhen="lower"
            approximate={m.from.confidence !== "observed" || m.to.confidence !== "observed"}
          />
        </span>
      ))}
    </div>
  );
}

function RunsTable({ experiment: e }: { experiment: Experiment }) {
  const labelById = Object.fromEntries(e.configurations.map((c) => [c.id, c.label]));
  return (
    <Section title={`Runs (${e.results.length})`}>
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="pl-4">Configuration</TableHead>
              <TableHead>Run</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Checkers</TableHead>
              <TableHead>Durée</TableHead>
              <TableHead>Tokens</TableHead>
              <TableHead>Coût</TableHead>
              <TableHead>Tool calls</TableHead>
              <TableHead>Interventions</TableHead>
              <TableHead className="pr-4">Trace</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {e.results.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-4 text-muted-foreground">
                  {labelById[r.configurationId] ?? r.configurationId}
                </TableCell>
                <TableCell className="tabular-nums">#{r.run}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className={cn("size-2.5 rounded-full", RUN_STATUS_META[r.status].dot)} />
                    {RUN_STATUS_META[r.status].label}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1">
                    {r.checks.map((c) => {
                      const checker = e.checkers.find((k) => k.id === c.checkerId);
                      return (
                        <Tooltip key={c.checkerId}>
                          <TooltipTrigger asChild>
                            <span
                              className={cn(
                                "inline-flex h-5 items-center gap-1 rounded border px-1.5 text-[11px]",
                                c.passed
                                  ? "border-success/35 bg-success/10 text-success"
                                  : "border-destructive/35 bg-destructive/10 text-destructive",
                              )}
                            >
                              {c.passed ? <Check className="size-3" /> : <X className="size-3" />}
                              {checker?.label ?? c.checkerId}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="flex-col items-start gap-0.5">
                            <code className="font-mono">{checker?.command}</code>
                            {c.detail && <span>{c.detail}</span>}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </span>
                </TableCell>
                <TableCell>
                  <ObservedValue obs={r.durationMs} format={formatDuration} hideBadge />
                </TableCell>
                <TableCell>
                  <ObservedValue obs={runTokens(r)} format={formatTokens} />
                </TableCell>
                <TableCell>
                  <ObservedValue obs={r.cost} format={formatCost} />
                </TableCell>
                <TableCell>
                  <ObservedValue obs={r.toolCalls} format={formatNumber} hideBadge />
                </TableCell>
                <TableCell className="tabular-nums">{r.userInterventions}</TableCell>
                <TableCell className="pr-4">
                  {r.sessionId ? (
                    <Link
                      to={links.observeSession(r.sessionId)}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      Ouvrir
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground" title="Trace non conservée pour ce run">
                      —
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}
