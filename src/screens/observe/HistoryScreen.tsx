import { GitCompareArrows, History, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HarnessBadge, ModelLabel, SessionStatusBadge, WorkloadBadge } from "@/components/warden/badges";
import { EmptyState, Page } from "@/components/warden/page";
import { formatCost, formatDateTime, formatDuration, formatRelative, formatTokens } from "@/lib/format";
import { SESSION_STATUS_LABELS, WORKLOAD_LABELS } from "@/lib/labels";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import { allSessionsNewestFirst, getHarness, getModel, getProject } from "@/mock/queries";
import type { Session } from "@/mock/types";
import { totalTokens } from "./analysis";
import { CompactObserved, ConfidenceLegend } from "./observe-ui";

const ALL = "all";

type FilterKey = "project" | "harness" | "model" | "status" | "workload";

const FILTER_FIELDS: Record<FilterKey, { label: string; pick: (s: Session) => string; name: (id: string) => string }> =
  {
    project: { label: "Projet", pick: (s) => s.projectId, name: (id) => getProject(id)?.name ?? id },
    harness: { label: "Harness", pick: (s) => s.harnessId, name: (id) => getHarness(id as Session["harnessId"]).name },
    model: { label: "Modèle", pick: (s) => s.modelId, name: (id) => getModel(id).name },
    status: {
      label: "Statut",
      pick: (s) => s.status,
      name: (id) => SESSION_STATUS_LABELS[id as Session["status"]],
    },
    workload: { label: "Workload", pick: (s) => s.workload, name: (id) => WORKLOAD_LABELS[id as Session["workload"]] },
  };

const FILTER_KEYS = Object.keys(FILTER_FIELDS) as FilterKey[];

const NO_FILTERS: Record<FilterKey, string> = { project: ALL, harness: ALL, model: ALL, status: ALL, workload: ALL };

/** CDC §19 — find, consult and compare any past session. */
export function HistoryScreen() {
  const navigate = useNavigate();
  const sessions = useMemo(allSessionsNewestFirst, []);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(NO_FILTERS);
  const [selected, setSelected] = useState<string[]>([]);

  const options = useMemo(
    () =>
      Object.fromEntries(
        FILTER_KEYS.map((key) => [key, [...new Set(sessions.map(FILTER_FIELDS[key].pick))]]),
      ) as Record<FilterKey, string[]>,
    [sessions],
  );

  const needle = query.trim().toLowerCase();
  const visible = sessions.filter(
    (s) =>
      (!needle || s.title.toLowerCase().includes(needle)) &&
      FILTER_KEYS.every((key) => filters[key] === ALL || FILTER_FIELDS[key].pick(s) === filters[key]),
  );
  const filtered = needle !== "" || FILTER_KEYS.some((key) => filters[key] !== ALL);

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => (checked ? [...prev, id].slice(-2) : prev.filter((x) => x !== id)));

  return (
    <Page
      title="Historique des sessions"
      subtitle={`${sessions.length} sessions conservées par Warden, tous projets et harnesses confondus`}
      actions={
        <>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              <X />
              Désélectionner
            </Button>
          )}
          <Button
            size="sm"
            disabled={selected.length !== 2}
            onClick={() => navigate(links.compare(selected[0], selected[1]))}
            title={selected.length === 2 ? undefined : "Cochez exactement deux sessions"}
          >
            <GitCompareArrows />
            Comparer ({selected.length}/2)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un titre de session…"
              className="h-8 pl-8"
            />
          </div>
          {FILTER_KEYS.map((key) => (
            <Select
              key={key}
              value={filters[key]}
              onValueChange={(value) => setFilters((f) => ({ ...f, [key]: value }))}
            >
              <SelectTrigger size="sm" className={cn("min-w-32", filters[key] !== ALL && "border-primary/60")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{FILTER_FIELDS[key].label} : tous</SelectItem>
                {options[key].map((id) => (
                  <SelectItem key={id} value={id}>
                    {FILTER_FIELDS[key].name(id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setFilters(NO_FILTERS);
              }}
            >
              Réinitialiser
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {visible.length} / {sessions.length} sessions
          </span>
        </div>

        {visible.length === 0 ? (
          <EmptyState icon={<History />} title="Aucune session ne correspond">
            Modifiez la recherche ou les filtres.
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Session</TableHead>
                  <TableHead>Projet</TableHead>
                  <TableHead>Harness</TableHead>
                  <TableHead>Modèle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead className="text-right">Durée</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Coût</TableHead>
                  <TableHead className="text-right">Fichiers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((s) => {
                  const isSelected = selected.includes(s.id);
                  return (
                    <TableRow
                      key={s.id}
                      className={cn("cursor-pointer", isSelected && "bg-primary/5")}
                      onClick={() => navigate(links.observeSession(s.id))}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => toggle(s.id, checked === true)}
                          aria-label={`Sélectionner ${s.title} pour comparaison`}
                        />
                      </TableCell>
                      <TableCell className="max-w-80">
                        <div className="truncate font-medium">{s.title}</div>
                        <WorkloadBadge workload={s.workload} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {getProject(s.projectId)?.name ?? s.projectId}
                      </TableCell>
                      <TableCell>
                        <HarnessBadge harnessId={s.harnessId} />
                      </TableCell>
                      <TableCell>
                        <ModelLabel providerId={s.providerId} modelId={s.modelId} />
                      </TableCell>
                      <TableCell>
                        <SessionStatusBadge status={s.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground" title={formatDateTime(s.startedAt)}>
                        {formatRelative(s.startedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <CompactObserved obs={s.metrics.durationMs} format={formatDuration} />
                      </TableCell>
                      <TableCell className="text-right">
                        <CompactObserved obs={totalTokens(s.metrics)} format={formatTokens} />
                      </TableCell>
                      <TableCell className="text-right">
                        <CompactObserved obs={s.metrics.cost} format={formatCost} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.filesChanged.length || <span className="text-muted-foreground">0</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <ConfidenceLegend />
      </div>
    </Page>
  );
}
