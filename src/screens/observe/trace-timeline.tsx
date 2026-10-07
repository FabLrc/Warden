import { AlertOctagon, ChevronDown, ChevronRight, ListFilter, ScrollText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { EmptyState } from "@/components/warden/page";
import { TRACE_KIND_META, TraceKindIcon } from "@/components/warden/trace-meta";
import { formatDuration, formatTime, formatTokens } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Session, TraceEvent, TraceEventKind } from "@/mock/types";
import { depthOf, formatOffset, isError, offsetMs } from "./analysis";
import { CompactObserved, FileLink, TraceStatusBadge } from "./observe-ui";

const ALL_TOOLS = "all";

/** CDC §18 — chronological trace with parent/child nesting and filters. */
export function TraceTimeline({
  session,
  trace,
  selectedId,
  onSelect,
}: {
  session: Session;
  trace: TraceEvent[];
  selectedId?: string;
  onSelect: (eventId: string) => void;
}) {
  const [kinds, setKinds] = useState<TraceEventKind[]>([]);
  const [query, setQuery] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [tool, setTool] = useState(ALL_TOOLS);
  const [collapsed, setCollapsed] = useState<string[]>([]);

  const byId = useMemo(() => new Map(trace.map((e) => [e.id, e])), [trace]);
  const childCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of trace) if (e.parentId) counts[e.parentId] = (counts[e.parentId] ?? 0) + 1;
    return counts;
  }, [trace]);
  const presentKinds = useMemo(() => [...new Set(trace.map((e) => e.kind))], [trace]);
  const tools = useMemo(() => [...new Set(trace.flatMap((e) => (e.tool ? [e.tool] : [])))], [trace]);

  const needle = query.trim().toLowerCase();
  const filtering = kinds.length > 0 || needle !== "" || errorsOnly || tool !== ALL_TOOLS;
  const isHiddenByCollapse = (e: TraceEvent) => {
    let parent = e.parentId ? byId.get(e.parentId) : undefined;
    while (parent) {
      if (collapsed.includes(parent.id)) return true;
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    return false;
  };
  const visible = trace.filter(
    (e) =>
      (kinds.length === 0 || kinds.includes(e.kind)) &&
      (!errorsOnly || isError(e)) &&
      (tool === ALL_TOOLS || e.tool === tool) &&
      (!needle ||
        [e.title, e.text, e.command, e.output, e.file?.path, e.tool].some((field) =>
          field?.toLowerCase().includes(needle),
        )) &&
      (filtering || !isHiddenByCollapse(e)),
  );

  useEffect(() => {
    if (!selectedId) return;
    document.querySelector(`[data-event-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const resetFilters = () => {
    setKinds([]);
    setQuery("");
    setErrorsOnly(false);
    setTool(ALL_TOOLS);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-6 py-2.5">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans la trace…"
            className="h-8 pl-8"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={cn(kinds.length > 0 && "border-primary/60")}>
              <ListFilter />
              Types : {kinds.length === 0 ? "tous" : kinds.length}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Types d'événements</DropdownMenuLabel>
            {presentKinds.map((kind) => (
              <DropdownMenuCheckboxItem
                key={kind}
                checked={kinds.includes(kind)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(checked) =>
                  setKinds((prev) => (checked ? [...prev, kind] : prev.filter((k) => k !== kind)))
                }
              >
                <TraceKindIcon kind={kind} />
                {TRACE_KIND_META[kind].label}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {trace.filter((e) => e.kind === kind).length}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={kinds.length === 0} onSelect={() => setKinds([])}>
              Tout afficher
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Select value={tool} onValueChange={setTool}>
          <SelectTrigger size="sm" className={cn("min-w-36", tool !== ALL_TOOLS && "border-primary/60")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TOOLS}>Outil : tous</SelectItem>
            {tools.map((t) => (
              <SelectItem key={t} value={t}>
                <span className="font-mono">{t}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Toggle
          variant="outline"
          size="sm"
          pressed={errorsOnly}
          onPressedChange={setErrorsOnly}
          className="data-[state=on]:border-destructive/50 data-[state=on]:text-destructive"
        >
          <AlertOctagon />
          Erreurs uniquement
        </Toggle>
        {filtering && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Réinitialiser
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {visible.length} / {trace.length} événements
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
        {visible.length === 0 ? (
          <div className="p-3">
            <EmptyState icon={<ScrollText />} title="Aucun événement ne correspond aux filtres">
              <Button variant="link" size="sm" onClick={resetFilters}>
                Réinitialiser les filtres
              </Button>
            </EmptyState>
          </div>
        ) : (
          <ol className="space-y-px">
            {visible.map((e) => (
              <TraceRow
                key={e.id}
                event={e}
                session={session}
                depth={depthOf(e, byId)}
                childTotal={childCount[e.id] ?? 0}
                collapsed={collapsed.includes(e.id)}
                collapsible={!filtering}
                selected={e.id === selectedId}
                onToggle={() =>
                  setCollapsed((prev) => (prev.includes(e.id) ? prev.filter((id) => id !== e.id) : [...prev, e.id]))
                }
                onSelect={() => onSelect(e.id)}
              />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function TraceRow({
  event,
  session,
  depth,
  childTotal,
  collapsed,
  collapsible,
  selected,
  onToggle,
  onSelect,
}: {
  event: TraceEvent;
  session: Session;
  depth: number;
  childTotal: number;
  collapsed: boolean;
  collapsible: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const error = isError(event);
  return (
    <li
      data-event-id={event.id}
      className={cn(
        "group flex items-center gap-2 rounded-md border border-transparent pr-2 text-sm",
        selected ? "border-primary/50 bg-primary/10" : "hover:bg-accent/50",
        error && !selected && "bg-destructive/5",
      )}
    >
      <span className="w-28 shrink-0 pl-2 font-mono text-[11px] text-muted-foreground tabular-nums">
        {formatTime(event.at)}
        <span className="ml-1.5 opacity-70">{formatOffset(offsetMs(session, event))}</span>
      </span>
      <span className="flex shrink-0 items-center" style={{ paddingLeft: depth * 20 }}>
        {childTotal > 0 && collapsible ? (
          <button
            type="button"
            onClick={onToggle}
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={collapsed ? "Déplier les événements enfants" : "Replier les événements enfants"}
            title={collapsed ? `Déplier (${childTotal} enfants)` : "Replier"}
          >
            {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        ) : (
          <span className="flex size-5 justify-center">
            {depth > 0 && <span className="h-full border-l border-border/70" />}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
        aria-current={selected || undefined}
      >
        <TraceKindIcon kind={event.kind} />
        <span className={cn("truncate", error && "text-destructive")}>{event.title}</span>
        {event.tool && (
          <span className="shrink-0 rounded border border-border px-1 font-mono text-[10px] text-muted-foreground">
            {event.tool}
          </span>
        )}
        {collapsed && childTotal > 0 && (
          <span className="shrink-0 text-[11px] text-muted-foreground">+{childTotal} masqués</span>
        )}
      </button>
      {event.file && (
        <FileLink
          projectId={session.projectId}
          sessionId={session.id}
          file={event.file}
          view={event.kind === "file-edit" ? "diff" : "file"}
          className="max-w-56 shrink opacity-70 group-hover:opacity-100"
        />
      )}
      {event.tokens && (
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          <CompactObserved obs={event.tokens.input} format={formatTokens} />
          <span>→</span>
          <CompactObserved obs={event.tokens.output} format={formatTokens} />
        </span>
      )}
      <span className="w-14 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
        {event.durationMs !== undefined ? formatDuration(event.durationMs) : ""}
      </span>
      <span className="flex w-16 shrink-0 justify-end">
        {event.status && <TraceStatusBadge status={event.status} />}
      </span>
    </li>
  );
}
