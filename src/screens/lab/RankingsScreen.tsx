import { AlertTriangle, ArrowDown, RotateCcw, Trophy } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HarnessBadge, ModelLabel, WorkloadBadge } from "@/components/warden/badges";
import { ObservedValue } from "@/components/warden/observation";
import { Page, Section } from "@/components/warden/page";
import { formatCost, formatDuration, formatPercent, formatTokens } from "@/lib/format";
import { WORKLOAD_LABELS } from "@/lib/labels";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import { harnesses } from "@/mock/fixtures/catalog";
import { rankingEntries } from "@/mock/fixtures/lab";
import { getHarness, getModel } from "@/mock/queries";
import type { HarnessId, Workload } from "@/mock/types";
import { TOGGLE_ON } from "@/screens/lab/lab-meta";
import { LOW_SAMPLE_RUNS } from "@/screens/lab/lab-stats";
import { type MatrixMetric, RankingMatrix } from "@/screens/lab/RankingMatrix";
import {
  CRITERIA,
  CRITERION_IDS,
  type CriterionId,
  entryKey,
  RANKED_MODELS,
  type ScoredEntry,
  scoreEntries,
  WEIGHT_PRESETS,
  type Weights,
} from "@/screens/lab/ranking-score";

const ALL = "all";
type SortKey = "score" | "runs" | CriterionId;

const WORKLOADS = Object.keys(WORKLOAD_LABELS) as Workload[];
const fmt1 = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export function RankingsScreen() {
  const [workload, setWorkload] = useState<Workload | typeof ALL>(ALL);
  const [harnessId, setHarnessId] = useState<HarnessId | typeof ALL>(ALL);
  const [modelId, setModelId] = useState<string>(ALL);
  const [hideLowSample, setHideLowSample] = useState(false);
  const [weights, setWeights] = useState<Weights>(WEIGHT_PRESETS[0].weights);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [matrixWorkload, setMatrixWorkload] = useState<Workload>("debugging");
  const [matrixMetric, setMatrixMetric] = useState<MatrixMetric>("success");
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const pool = rankingEntries.filter(
    (e) =>
      (workload === ALL || e.workload === workload) &&
      (harnessId === ALL || e.harnessId === harnessId) &&
      (modelId === ALL || e.modelId === modelId) &&
      (!hideLowSample || e.runs >= LOW_SAMPLE_RUNS),
  );
  const scored = scoreEntries(pool, weights);
  const rows = [...scored].sort((a, b) => compareRows(a, b, sortKey));
  const byScore = [...scored].sort((a, b) => compareRows(a, b, "score"));
  const bestReliable = byScore.find((s) => s.entry.runs >= LOW_SAMPLE_RUNS);
  const bestOverall = byScore[0];
  const matrixScored = scoreEntries(
    rankingEntries.filter((e) => e.workload === matrixWorkload),
    weights,
  );
  const activePreset = WEIGHT_PRESETS.find((p) => CRITERION_IDS.every((id) => p.weights[id] === weights[id]));

  const changeWorkload = (w: Workload | typeof ALL) => {
    setWorkload(w);
    if (w !== ALL) setMatrixWorkload(w);
  };

  return (
    <Page title="Rankings" subtitle="Classement personnel Model × Harness × Workload, construit à partir de vos runs">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label="Workload"
              value={workload}
              onChange={(v) => changeWorkload(v as Workload | typeof ALL)}
              options={WORKLOADS.map((w) => ({ value: w, label: WORKLOAD_LABELS[w] }))}
            />
            <FilterSelect
              label="Harness"
              value={harnessId}
              onChange={(v) => setHarnessId(v as HarnessId | typeof ALL)}
              options={harnesses.map((h) => ({ value: h.id, label: h.name }))}
            />
            <FilterSelect
              label="Modèle"
              value={modelId}
              onChange={setModelId}
              options={RANKED_MODELS.map((m) => ({ value: m.id, label: m.name }))}
            />
            <div className="ml-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                id="rankings-hide-low-sample"
                size="sm"
                checked={hideLowSample}
                onCheckedChange={setHideLowSample}
              />
              <label htmlFor="rankings-hide-low-sample">Masquer les échantillons &lt; {LOW_SAMPLE_RUNS} runs</label>
            </div>
          </div>

          <BestCallout workload={workload} reliable={bestReliable} overall={bestOverall} />

          <Section title={`Classement (${rows.length})`}>
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-8 pl-4">#</TableHead>
                    <TableHead>Configuration</TableHead>
                    {workload === ALL && <TableHead>Workload</TableHead>}
                    <SortHead id="score" sortKey={sortKey} onSort={setSortKey} className="text-primary">
                      Score
                    </SortHead>
                    {CRITERION_IDS.map((id) => (
                      <SortHead key={id} id={id} sortKey={sortKey} onSort={setSortKey} help={CRITERIA[id].help}>
                        {CRITERIA[id].label}
                      </SortHead>
                    ))}
                    <SortHead id="runs" sortKey={sortKey} onSort={setSortKey} className="pr-4">
                      Runs
                    </SortHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s, i) => {
                    const e = s.entry;
                    const key = entryKey(e);
                    const lowSample = e.runs < LOW_SAMPLE_RUNS;
                    return (
                      <TableRow key={key} className={cn(highlighted === key && "bg-primary/10 hover:bg-primary/15")}>
                        <TableCell className="pl-4 text-xs text-muted-foreground tabular-nums">{i + 1}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <ModelLabel providerId={getModel(e.modelId).providerId} modelId={e.modelId} />
                            <HarnessBadge harnessId={e.harnessId} className="w-fit" />
                          </div>
                        </TableCell>
                        {workload === ALL && (
                          <TableCell>
                            <WorkloadBadge workload={e.workload} />
                          </TableCell>
                        )}
                        <TableCell>
                          <ScoreCell scored={s} lowSample={lowSample} />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {e.quality.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="tabular-nums">{formatPercent(e.successRate)}</TableCell>
                        <TableCell>
                          <ObservedValue obs={e.avgCostUsd} format={formatCost} />
                        </TableCell>
                        <TableCell>
                          <ObservedValue obs={e.avgTokens} format={formatTokens} hideBadge />
                        </TableCell>
                        <TableCell className="tabular-nums">{formatDuration(e.avgDurationMs)}</TableCell>
                        <TableCell className="tabular-nums">
                          σ {e.variance.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="tabular-nums">{fmt1(e.toolEfficiency)}</TableCell>
                        <TableCell className="tabular-nums">{fmt1(e.avgInterventions)}</TableCell>
                        <TableCell className="pr-4">
                          <span
                            className={cn("flex items-center gap-1 tabular-nums", lowSample && "text-warning")}
                            title={lowSample ? `Échantillon faible : moins de ${LOW_SAMPLE_RUNS} runs` : undefined}
                          >
                            {e.runs}
                            {lowSample && <AlertTriangle className="size-3" />}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={workload === ALL ? 13 : 12}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        Aucun run ne correspond à ces filtres.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Le score est relatif aux lignes affichées (chaque critère ramené entre le pire et le meilleur). Les
              métriques brutes restent toujours visibles ; un coût Unavailable est exclu du score, jamais compté comme
              0.
            </p>
          </Section>

          <Section
            title={`Matrice Model × Harness · ${WORKLOAD_LABELS[matrixWorkload]}`}
            actions={
              <div className="flex items-center gap-2">
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={matrixMetric}
                  onValueChange={(v) => v && setMatrixMetric(v as MatrixMetric)}
                >
                  <ToggleGroupItem value="success" className={TOGGLE_ON}>
                    Réussite
                  </ToggleGroupItem>
                  <ToggleGroupItem value="score" className={TOGGLE_ON}>
                    Score
                  </ToggleGroupItem>
                </ToggleGroup>
                <Select value={matrixWorkload} onValueChange={(w) => setMatrixWorkload(w as Workload)}>
                  <SelectTrigger size="sm" className="min-w-36" aria-label="Workload de la matrice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKLOADS.map((w) => (
                      <SelectItem key={w} value={w}>
                        {WORKLOAD_LABELS[w]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
          >
            <RankingMatrix
              workload={matrixWorkload}
              scored={matrixScored}
              metric={matrixMetric}
              highlighted={highlighted}
              onSelect={(key) => {
                changeWorkload(matrixWorkload);
                setHarnessId(ALL);
                setModelId(ALL);
                setHighlighted(key);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Bordure pointillée : moins de {LOW_SAMPLE_RUNS} runs. Hachures : combinaison non supportée. Les cellules
              vides n'ont jamais été mesurées : lancez une{" "}
              <Link to={links.newExperiment()} className="text-primary hover:underline">
                expérience
              </Link>{" "}
              pour les remplir.
            </p>
          </Section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <div className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pondérations</span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setWeights(WEIGHT_PRESETS[0].weights)}
                aria-label="Réinitialiser les pondérations"
                title="Réinitialiser"
              >
                <RotateCcw />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WEIGHT_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  size="xs"
                  variant={activePreset?.id === p.id ? "secondary" : "outline"}
                  className={cn(activePreset?.id === p.id && "text-primary")}
                  onClick={() => setWeights(p.weights)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="space-y-3">
              {CRITERION_IDS.map((id) => (
                <div key={id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span title={CRITERIA[id].help}>{CRITERIA[id].label}</span>
                    <span className={cn("tabular-nums", weights[id] === 0 ? "text-muted-foreground" : "text-primary")}>
                      {weights[id] === 0 ? "ignoré" : `×${weights[id]}`}
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={5}
                    step={1}
                    value={[weights[id]]}
                    onValueChange={([v]) => setWeights((w) => ({ ...w, [id]: v }))}
                    aria-label={`Poids ${CRITERIA[id].label}`}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Le score global est un outil de tri, pas un verdict : il dépend entièrement de ces poids.
            </p>
          </div>
        </aside>
      </div>
    </Page>
  );
}

function compareRows(a: ScoredEntry, b: ScoredEntry, key: SortKey): number {
  if (key === "score") return (b.score ?? -1) - (a.score ?? -1);
  if (key === "runs") return b.entry.runs - a.entry.runs;
  const { value, better } = CRITERIA[key];
  const va = value(a.entry);
  const vb = value(b.entry);
  if (va === null || vb === null) return va === null ? (vb === null ? 0 : 1) : -1;
  return better === "higher" ? vb - va : va - vb;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="min-w-40" aria-label={label}>
        <span className="text-muted-foreground">{label}</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Tous</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SortHead({
  id,
  sortKey,
  onSort,
  help,
  className,
  children,
}: {
  id: SortKey;
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
  help?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(id)}
        title={help ? `${help} Cliquer pour trier.` : "Cliquer pour trier"}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", sortKey === id && "text-primary")}
      >
        {children}
        {sortKey === id && <ArrowDown className="size-3" />}
      </button>
    </TableHead>
  );
}

function ScoreCell({ scored: s, lowSample }: { scored: ScoredEntry; lowSample: boolean }) {
  if (s.score === null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("w-24", lowSample && "opacity-60")}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold tabular-nums text-primary">{Math.round(s.score)}</span>
            {s.missing.length > 0 && <span className="text-[10px] text-warning">partiel</span>}
          </div>
          <div className="mt-1 h-1 rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${s.score}%` }} />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-0.5">
        <span>Score composite sur 100, selon les pondérations.</span>
        {s.missing.length > 0 && (
          <span className="text-warning">
            Non pris en compte (Unavailable) : {s.missing.map((id) => CRITERIA[id].label).join(", ")}
          </span>
        )}
        {lowSample && <span className="text-warning">Échantillon faible : score peu fiable.</span>}
      </TooltipContent>
    </Tooltip>
  );
}

function BestCallout({
  workload,
  reliable,
  overall,
}: {
  workload: Workload | typeof ALL;
  reliable?: ScoredEntry;
  overall?: ScoredEntry;
}) {
  if (!overall) return null;
  const names = [reliable, overall].map((s) =>
    s ? `${getModel(s.entry.modelId).name} × ${getHarness(s.entry.harnessId).name}` : "",
  );
  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
      <Trophy className="mt-0.5 size-4 shrink-0 text-soul" />
      <div className="min-w-0 space-y-1 text-sm">
        {reliable ? (
          <div>
            Meilleure configuration{" "}
            {workload === ALL ? "toutes catégories confondues" : `pour ${WORKLOAD_LABELS[workload].toLowerCase()}`} :{" "}
            <span className="font-semibold text-primary text-glow">{names[0]}</span>{" "}
            <span className="text-muted-foreground">
              · score {Math.round(reliable.score ?? 0)} · réussite {formatPercent(reliable.entry.successRate)} sur{" "}
              {reliable.entry.runs} runs
            </span>
          </div>
        ) : (
          <div>Aucune configuration n'a encore {LOW_SAMPLE_RUNS} runs ou plus avec ces filtres.</div>
        )}
        {overall !== reliable && (
          <div className="flex items-center gap-1.5 text-xs text-warning">
            <AlertTriangle className="size-3.5" />
            {names[1]} a un meilleur score ({Math.round(overall.score ?? 0)}) mais seulement {overall.entry.runs} runs :
            à confirmer.
          </div>
        )}
        {workload === ALL && (
          <div className="text-xs text-muted-foreground">
            Un modèle peut exceller en debugging et moins en frontend : choisissez un workload pour un classement
            pertinent.
          </div>
        )}
      </div>
    </div>
  );
}
