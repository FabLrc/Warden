import { FlaskConical, OctagonX, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WorkloadBadge } from "@/components/warden/badges";
import { EmptyState, Page } from "@/components/warden/page";
import { formatPercent, formatRelative } from "@/lib/format";
import { VARIABLE_LABELS } from "@/lib/labels";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import { experiments } from "@/mock/fixtures/lab";
import type { Experiment } from "@/mock/types";
import { ExperimentStatusBadge, RUN_STATUS_META, TOGGLE_ON } from "@/screens/lab/lab-meta";
import { configStats } from "@/screens/lab/lab-stats";
import { analyzeExperiment } from "@/screens/lab/reproducibility";

type StatusFilter = "all" | Experiment["status"];

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "completed", label: "Terminées" },
  { id: "draft", label: "Brouillons" },
];

export function ExperimentsScreen() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const shown = [...experiments]
    .filter((e) => filter === "all" || e.status === filter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Page
      title="Expériences"
      subtitle="Comparer des configurations sur une même tâche, validées par des checkers externes"
      actions={
        <Button size="sm" asChild>
          <Link to={links.newExperiment()}>
            <Plus />
            Nouvelle expérience
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Une expérience lance la même tâche, depuis le même état du repository, avec plusieurs configurations qui ne
          diffèrent que par <span className="text-foreground">une seule variable</span>. Chaque configuration est
          répétée pour mesurer la variance, et la réussite est jugée par des tests, lint ou build — jamais par l'agent
          lui-même.
        </p>

        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={filter}
          onValueChange={(v) => v && setFilter(v as StatusFilter)}
        >
          {FILTERS.map((f) => (
            <ToggleGroupItem key={f.id} value={f.id} className={TOGGLE_ON}>
              {f.label}
              <span className="text-muted-foreground tabular-nums">
                {f.id === "all" ? experiments.length : experiments.filter((e) => e.status === f.id).length}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {shown.length === 0 ? (
          <EmptyState icon={<FlaskConical />} title="Aucune expérience dans cette catégorie" />
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="pl-4">Expérience</TableHead>
                  <TableHead>Variable</TableHead>
                  <TableHead>Workload</TableHead>
                  <TableHead>Projet</TableHead>
                  <TableHead>Runs</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="pr-4">Résultat par configuration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((e) => (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => navigate(links.experiment(e.id))}>
                    <TableCell className="max-w-80 pl-4">
                      <Link
                        to={links.experiment(e.id)}
                        className="block truncate font-medium hover:text-primary"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        {e.name}
                      </Link>
                      <div className="truncate text-xs text-muted-foreground">
                        {e.configurations.map((c) => c.label).join(" vs ")} · {formatRelative(e.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex h-5 items-center rounded border border-primary/30 bg-primary/10 px-1.5 text-[11px] text-primary">
                        {VARIABLE_LABELS[e.variable]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <WorkloadBadge workload={e.workload} />
                    </TableCell>
                    <TableCell>
                      <Link
                        to={links.project(e.projectId)}
                        className="font-mono text-xs text-muted-foreground hover:text-foreground"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        {e.projectId}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {e.configurations.length} × {e.runsPerConfiguration}
                    </TableCell>
                    <TableCell>
                      <ExperimentStatusBadge status={e.status} />
                    </TableCell>
                    <TableCell className="pr-4">
                      <ResultSummary experiment={e} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Page>
  );
}

function ResultSummary({ experiment }: { experiment: Experiment }) {
  if (experiment.status === "draft") {
    const blocking = analyzeExperiment(experiment).filter((i) => i.severity === "blocking");
    return blocking.length > 0 ? (
      <span className="flex items-center gap-1.5 text-xs text-destructive">
        <OctagonX className="size-3.5" />
        Ne peut pas être lancée : {blocking[0].title}
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">Prête à lancer</span>
    );
  }
  return (
    <div className="space-y-1">
      {experiment.configurations.map((c) => {
        const s = configStats(experiment, c.id);
        return (
          <div key={c.id} className="flex items-center gap-2 text-xs">
            <span className="w-32 truncate text-muted-foreground">{c.label}</span>
            <span className="flex gap-1">
              {s.runs.map((r) => (
                <span
                  key={r.id}
                  className={cn("size-2 rounded-full", RUN_STATUS_META[r.status].dot)}
                  title={`Run ${r.run} : ${RUN_STATUS_META[r.status].label}`}
                />
              ))}
            </span>
            <span className="tabular-nums">
              {s.passed}/{s.finished}
              {s.successRate !== null && (
                <span className="ml-1 text-muted-foreground">({formatPercent(s.successRate)})</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
