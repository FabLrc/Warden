import { AlertTriangle, Copy, FlaskConical, Pencil, Play } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HarnessBadge, ModelLabel, WorkloadBadge } from "@/components/warden/badges";
import { Markdown } from "@/components/warden/markdown";
import { EmptyState, Page, Section } from "@/components/warden/page";
import { formatDateTime } from "@/lib/format";
import { VARIABLE_LABELS } from "@/lib/labels";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import { experiments, WARDEN_FEATURE_LABELS, type WardenFeatureId } from "@/mock/fixtures/lab";
import { getAgent, getProject, getSkill } from "@/mock/queries";
import type { Experiment, LabConfiguration } from "@/mock/types";
import { ExperimentResults } from "@/screens/lab/ExperimentResults";
import { CHECKER_KIND_LABELS, ExperimentStatusBadge, ISOLATION_HELP, ISOLATION_LABELS } from "@/screens/lab/lab-meta";
import { ReproducibilityPanel } from "@/screens/lab/ReproducibilityPanel";
import {
  analyzeExperiment,
  DIMENSION_LABELS,
  type Dimension,
  differingDimensions,
  VARIABLE_DIMENSION,
} from "@/screens/lab/reproducibility";

export function ExperimentScreen() {
  const { experimentId } = useParams();
  const experiment = experiments.find((e) => e.id === experimentId);
  if (!experiment) {
    return (
      <Page title="Expérience introuvable">
        <EmptyState icon={<FlaskConical />} title={`Aucune expérience « ${experimentId ?? ""} »`}>
          <Link to={links.lab()} className="text-primary hover:underline">
            Revenir aux expériences
          </Link>
        </EmptyState>
      </Page>
    );
  }
  return <ExperimentView experiment={experiment} />;
}

function ExperimentView({ experiment: e }: { experiment: Experiment }) {
  const issues = analyzeExperiment(e);
  const blocking = issues.filter((i) => i.severity === "blocking");
  const project = getProject(e.projectId);
  const copyLink = `${links.newExperiment()}?from=${e.id}`;

  return (
    <Page
      title={
        <span className="flex items-center gap-2">
          {e.name}
          <ExperimentStatusBadge status={e.status} />
        </span>
      }
      subtitle={`Variable étudiée : ${VARIABLE_LABELS[e.variable]} · ${project?.name ?? e.projectId} · créée le ${formatDateTime(e.createdAt)}`}
      actions={
        e.status === "draft" ? (
          <>
            <Button size="sm" variant="outline" asChild>
              <Link to={copyLink}>
                <Pencil />
                Modifier
              </Link>
            </Button>
            {blocking.length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="sm" disabled>
                      <Play />
                      Lancer
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{blocking[0].title}</TooltipContent>
              </Tooltip>
            ) : (
              <Button size="sm" asChild>
                <Link to={copyLink}>
                  <Play />
                  Lancer…
                </Link>
              </Button>
            )}
          </>
        ) : (
          <Button size="sm" variant="outline" asChild>
            <Link to={copyLink}>
              <Copy />
              Dupliquer
            </Link>
          </Button>
        )
      }
    >
      <div className="space-y-8">
        <Definition experiment={e} />
        <Configurations experiment={e} />
        {e.status === "draft" ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <EmptyState icon={<FlaskConical />} title="Aucun run : cette expérience est un brouillon">
              {blocking.length > 0
                ? "Corrigez les problèmes bloquants avant de pouvoir la lancer."
                : "Elle peut être lancée ; les résultats apparaîtront ici, configuration par configuration."}
            </EmptyState>
            <ReproducibilityPanel definition={e} issues={issues} />
          </div>
        ) : (
          <ExperimentResults experiment={e} />
        )}
      </div>
    </Page>
  );
}

function Definition({ experiment: e }: { experiment: Experiment }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tâche</span>
          <WorkloadBadge workload={e.workload} />
        </div>
        <Markdown>{e.task}</Markdown>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
        <Fact label="État initial">
          <span className="font-mono text-xs text-soul">{e.initialState.ref}</span>
          <span className="block text-xs text-muted-foreground">{e.initialState.description}</span>
        </Fact>
        <Fact label="Isolation">
          {ISOLATION_LABELS[e.isolation]}
          <span className="block text-xs text-muted-foreground">{ISOLATION_HELP[e.isolation]}</span>
        </Fact>
        <Fact label="Runs">
          <span className="tabular-nums">
            {e.configurations.length} configurations × {e.runsPerConfiguration} runs
          </span>
          <span className="block text-xs text-muted-foreground">limite {e.timeLimitMinutes} min par run</span>
        </Fact>
        <Fact label="Checkers externes">
          {e.checkers.length === 0 ? (
            <span className="text-warning">Aucun</span>
          ) : (
            <ul className="space-y-1">
              {e.checkers.map((k) => (
                <li key={k.id} className="text-xs">
                  <span className="text-muted-foreground">{CHECKER_KIND_LABELS[k.kind]} · </span>
                  <code className="font-mono text-soul">{k.command}</code>
                </li>
              ))}
            </ul>
          )}
        </Fact>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-card p-3 text-sm">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Configurations({ experiment: e }: { experiment: Experiment }) {
  const studied = VARIABLE_DIMENSION[e.variable];
  const differing = differingDimensions(e.configurations);
  return (
    <Section
      title="Configurations"
      actions={
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2 rounded-sm bg-primary" /> variable étudiée : {VARIABLE_LABELS[e.variable]}
        </span>
      }
    >
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(e.configurations.length, 3)}, minmax(0, 1fr))` }}
      >
        {e.configurations.map((c) => (
          <div key={c.id} className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-3 py-2 text-sm font-medium">{c.label}</div>
            <div className="p-1.5">
              {(Object.keys(DIMENSION_LABELS) as Dimension[]).map((d) => (
                <ConfigRow
                  key={d}
                  dimension={d}
                  config={c}
                  studied={d === studied}
                  confounder={d !== studied && differing.includes(d)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ConfigRow({
  dimension,
  config: c,
  studied,
  confounder,
}: {
  dimension: Dimension;
  config: LabConfiguration;
  studied: boolean;
  confounder: boolean;
}) {
  const enabledFeatures = Object.entries(c.features).filter(([, on]) => on);
  const value: Record<Dimension, ReactNode> = {
    harness: <HarnessBadge harnessId={c.harnessId} />,
    model: <ModelLabel providerId={c.providerId} modelId={c.modelId} />,
    agent: c.agentId ? (getAgent(c.agentId)?.name ?? c.agentId) : <span className="text-muted-foreground">Aucun</span>,
    skills:
      c.skillIds.length > 0 ? (
        <span className="font-mono text-xs">{c.skillIds.map((id) => getSkill(id)?.name ?? id).join(", ")}</span>
      ) : (
        <span className="text-muted-foreground">Aucun</span>
      ),
    features:
      enabledFeatures.length > 0 ? (
        enabledFeatures.map(([id]) => WARDEN_FEATURE_LABELS[id as WardenFeatureId] ?? id).join(", ")
      ) : (
        <span className="text-muted-foreground">Aucune</span>
      ),
  };
  return (
    <div
      className={cn(
        "flex min-h-8 items-center justify-between gap-3 rounded-md border-l-2 border-transparent px-2 py-1 text-sm",
        studied && "border-primary bg-primary/8",
        confounder && "border-warning bg-warning/8",
      )}
    >
      <span className={cn("shrink-0 text-xs text-muted-foreground", studied && "text-primary")}>
        {DIMENSION_LABELS[dimension]}
        {confounder && (
          <AlertTriangle
            className="ml-1 inline size-3 text-warning"
            aria-label="Diffère alors que ce n'est pas la variable étudiée"
          />
        )}
      </span>
      <span className="min-w-0 truncate text-right">{value[dimension]}</span>
    </div>
  );
}
