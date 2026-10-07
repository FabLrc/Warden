import { AlertTriangle, ExternalLink, Minus, Scale, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { WorkloadBadge } from "@/components/warden/badges";
import { ObservedValue } from "@/components/warden/observation";
import { Page, Section } from "@/components/warden/page";
import { formatCost, formatDuration, formatPercent, formatTokens } from "@/lib/format";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import { experiments, type FeatureArmStats, type FeatureEvaluation, featureEvaluations } from "@/mock/fixtures/lab";
import { Delta } from "@/screens/lab/lab-meta";
import { armFromConfiguration, LOW_SAMPLE_RUNS, relativeDelta } from "@/screens/lab/lab-stats";

type Verdict = "improves" | "degrades" | "neutral" | "insufficient";

const VERDICT_META: Record<Verdict, { label: string; icon: typeof Scale; cls: string; text: string }> = {
  improves: {
    label: "Améliore",
    icon: TrendingUp,
    cls: "text-success border-success/35 bg-success/10",
    text: "text-success",
  },
  degrades: {
    label: "Dégrade",
    icon: TrendingDown,
    cls: "text-destructive border-destructive/35 bg-destructive/10",
    text: "text-destructive",
  },
  neutral: {
    label: "Sans effet mesurable",
    icon: Minus,
    cls: "text-muted-foreground border-border bg-muted/40",
    text: "text-muted-foreground",
  },
  insufficient: {
    label: "Données insuffisantes",
    icon: AlertTriangle,
    cls: "text-warning border-warning/35 bg-warning/10",
    text: "text-warning",
  },
};

const KIND_LABELS: Record<FeatureEvaluation["kind"], string> = {
  skill: "Skill",
  agent: "Agent",
  memory: "Mémoire",
  reviewer: "Reviewer",
  mcp: "MCP",
};

/** A success change smaller than this is treated as noise. */
const SUCCESS_THRESHOLD = 0.05;
/** A cost / token increase above this must be paid back by better success. */
const COST_THRESHOLD = 0.1;

interface Resolved {
  evaluation: FeatureEvaluation;
  off: FeatureArmStats;
  on: FeatureArmStats;
  experimentId?: string;
  verdict: Verdict;
  reason: string;
}

function resolve(evaluation: FeatureEvaluation): Resolved | null {
  const src = evaluation.source;
  let arms: { off: FeatureArmStats; on: FeatureArmStats; experimentId?: string };
  if (src.kind === "experiment") {
    const experiment = experiments.find((e) => e.id === src.experimentId);
    if (!experiment) return null;
    arms = {
      off: armFromConfiguration(experiment, src.offConfigurationId),
      on: armFromConfiguration(experiment, src.onConfigurationId),
      experimentId: experiment.id,
    };
  } else {
    arms = { off: src.off, on: src.on };
  }
  const { off, on, experimentId } = arms;

  const success = on.successRate - off.successRate;
  const successPts = Math.round(Math.abs(success) * 100);
  const cost = relativeDelta(off.avgCostUsd.value, on.avgCostUsd.value);
  const tokens = relativeDelta(off.avgTokens.value, on.avgTokens.value);
  const costlier = (cost ?? 0) > COST_THRESHOLD || (tokens ?? 0) > COST_THRESHOLD;
  const cheaper = cost !== null && cost < 0;

  let verdict: Verdict;
  let reason: string;
  if (Math.min(off.runs, on.runs) < LOW_SAMPLE_RUNS) {
    verdict = "insufficient";
    reason = `Moins de ${LOW_SAMPLE_RUNS} runs par bras (${off.runs} OFF / ${on.runs} ON) : l'écart observé peut être du bruit.`;
  } else if (success >= SUCCESS_THRESHOLD) {
    verdict = "improves";
    const costNote = costlier ? ", au prix d'un surcoût à surveiller" : cheaper ? " et moins cher par run" : "";
    reason = `+${successPts} pts de réussite${costNote}.`;
  } else if (success <= -SUCCESS_THRESHOLD) {
    verdict = "degrades";
    reason = `−${successPts} pts de réussite${costlier ? " et plus cher" : ""}.`;
  } else if (costlier) {
    verdict = "degrades";
    reason = "Coûte plus de contexte sans gain de réussite mesurable : la couche ne justifie pas son coût.";
  } else if (cost !== null && cost < -COST_THRESHOLD) {
    verdict = "improves";
    reason = "Réussite inchangée, mais moins chère.";
  } else {
    verdict = "neutral";
    reason = "Ni gain ni surcoût significatif.";
  }
  return { evaluation, off, on, experimentId, verdict, reason };
}

export function FeaturesScreen() {
  const resolved = featureEvaluations.flatMap((e) => {
    const r = resolve(e);
    return r ? [r] : [];
  });
  const counts = (Object.keys(VERDICT_META) as Verdict[]).map((v) => ({
    verdict: v,
    n: resolved.filter((r) => r.verdict === v).length,
  }));

  return (
    <Page title="Fonctionnalités ON / OFF" subtitle="Chaque couche agentique comparée à une baseline (CDC §26)">
      <div className="space-y-6">
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-5 py-4">
          <div className="flex items-center gap-2 text-base font-semibold text-soul text-glow">
            <Scale className="size-4" />
            Every layer must justify its cost
          </div>
          <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
            Mémoire, reviewer, sous-agent, skill, MCP, contexte supplémentaire : toute couche ajoutée consomme du
            contexte, du temps et de l'argent. Aucune ne devrait être activée par défaut sans données montrant qu'elle
            améliore la réussite, le coût, les tokens, le temps ou la fiabilité.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {counts.map(({ verdict, n }) => (
              <VerdictBadge key={verdict} verdict={verdict} suffix={` · ${n}`} />
            ))}
          </div>
        </div>

        <Section title={`Comparaisons (${resolved.length})`}>
          <div className="grid gap-4 2xl:grid-cols-2">
            {resolved.map((r) => (
              <FeatureCard key={r.evaluation.id} resolved={r} />
            ))}
          </div>
        </Section>
      </div>
    </Page>
  );
}

function VerdictBadge({ verdict, suffix = "" }: { verdict: Verdict; suffix?: string }) {
  const meta = VERDICT_META[verdict];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-medium", meta.cls)}>
      <Icon className="size-3.5" />
      {meta.label}
      {suffix}
    </span>
  );
}

function FeatureCard({ resolved: r }: { resolved: Resolved }) {
  const e = r.evaluation;
  const { off, on } = r;
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{e.name}</span>
            <span className="rounded border border-border px-1.5 text-[11px] text-muted-foreground">
              {KIND_LABELS[e.kind]}
            </span>
            <WorkloadBadge workload={e.workload} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
        </div>
        <VerdictBadge verdict={r.verdict} />
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="px-4 py-2 text-left font-medium">Métrique</th>
            <th className="px-2 py-2 text-left font-medium">OFF</th>
            <th className="px-2 py-2 text-left font-medium">ON</th>
            <th className="px-4 py-2 text-left font-medium">Écart</th>
          </tr>
        </thead>
        <tbody className="[&_td]:border-t [&_td]:border-border">
          <Row
            label="Réussite"
            off={<span className="tabular-nums">{formatPercent(off.successRate)}</span>}
            on={<span className="tabular-nums">{formatPercent(on.successRate)}</span>}
            delta={<Delta value={on.successRate - off.successRate} kind="points" betterWhen="higher" />}
          />
          <Row
            label="Coût moy."
            off={<ObservedValue obs={off.avgCostUsd} format={formatCost} />}
            on={<ObservedValue obs={on.avgCostUsd} format={formatCost} />}
            delta={
              <Delta
                value={relativeDelta(off.avgCostUsd.value, on.avgCostUsd.value)}
                kind="percent"
                betterWhen="lower"
                approximate={off.avgCostUsd.confidence !== "observed" || on.avgCostUsd.confidence !== "observed"}
              />
            }
          />
          <Row
            label="Tokens moy."
            off={<ObservedValue obs={off.avgTokens} format={formatTokens} hideBadge />}
            on={<ObservedValue obs={on.avgTokens} format={formatTokens} hideBadge />}
            delta={
              <Delta
                value={relativeDelta(off.avgTokens.value, on.avgTokens.value)}
                kind="percent"
                betterWhen="lower"
                approximate={off.avgTokens.confidence !== "observed" || on.avgTokens.confidence !== "observed"}
              />
            }
          />
          <Row
            label="Durée moy."
            off={<ObservedValue obs={off.avgDurationMs} format={formatDuration} hideBadge />}
            on={<ObservedValue obs={on.avgDurationMs} format={formatDuration} hideBadge />}
            delta={
              <Delta
                value={relativeDelta(off.avgDurationMs.value, on.avgDurationMs.value)}
                kind="percent"
                betterWhen="lower"
              />
            }
          />
          <Row
            label="Fiabilité (σ)"
            off={
              <span className="tabular-nums">{off.variance.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</span>
            }
            on={
              <span className="tabular-nums">{on.variance.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</span>
            }
            delta={<Delta value={on.variance - off.variance} kind="points" betterWhen="lower" />}
          />
          <Row
            label="Runs"
            off={<SampleSize runs={off.runs} />}
            on={<SampleSize runs={on.runs} />}
            delta={<span className="text-xs text-muted-foreground">min. {LOW_SAMPLE_RUNS} par bras</span>}
          />
        </tbody>
      </table>

      <div className="mt-auto space-y-2 border-t border-border px-4 py-3 text-xs">
        <p className={VERDICT_META[r.verdict].text}>{r.reason}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            Contexte ajouté par appel :
            <ObservedValue obs={e.contextCost} format={(v) => `${formatTokens(v)} tokens`} />
          </span>
          {r.experimentId ? (
            <Link
              to={links.experiment(r.experimentId)}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="size-3" />
              Voir l'expérience
            </Link>
          ) : (
            e.source.kind === "history" && <span className="max-w-sm text-right">{e.source.note}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, off, on, delta }: { label: string; off: ReactNode; on: ReactNode; delta: ReactNode }) {
  return (
    <tr>
      <td className="px-4 py-1.5 text-xs text-muted-foreground">{label}</td>
      <td className="px-2 py-1.5">{off}</td>
      <td className="px-2 py-1.5">{on}</td>
      <td className="px-4 py-1.5">{delta}</td>
    </tr>
  );
}

function SampleSize({ runs }: { runs: number }) {
  const low = runs < LOW_SAMPLE_RUNS;
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", low && "text-warning")}>
      {runs}
      {low && <AlertTriangle className="size-3" aria-label="Échantillon faible" />}
    </span>
  );
}
