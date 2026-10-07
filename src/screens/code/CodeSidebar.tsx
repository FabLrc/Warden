import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  File,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HarnessBadge, SessionStatusDot } from "@/components/warden/badges";
import { DiffStat } from "@/components/warden/diff-view";
import { formatRelative } from "@/lib/format";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import { getHarness } from "@/mock/queries";
import type { FileChangeKind, FileNode } from "@/mock/types";
import { CHANGE_META, type FileActivity, latestChange, type ProjectActivity } from "./model";

const FILE_ICON_BY_EXT: Record<string, typeof File> = {
  ts: FileCode2,
  tsx: FileCode2,
  rs: FileCode2,
  css: FileCode2,
  sql: FileCode2,
  json: FileJson,
  toml: FileJson,
  md: FileText,
};

const ancestorsOf = (path: string): string[] =>
  path
    .split("/")
    .slice(0, -1)
    .map((_, i, parts) => parts.slice(0, i + 1).join("/"));

/** Keeps files whose path matches the query, and the directories leading to them. */
function filterTree(nodes: FileNode[], query: string): FileNode[] {
  return nodes.flatMap((node) => {
    if (node.kind === "file") return node.path.toLowerCase().includes(query) ? [node] : [];
    const children = filterTree(node.children ?? [], query);
    return children.length > 0 ? [{ ...node, children }] : [];
  });
}

function hasChangedDescendant(node: FileNode, activity: ProjectActivity): boolean {
  return (node.children ?? []).some((child) =>
    child.kind === "dir" ? hasChangedDescendant(child, activity) : latestChange(activity.byPath.get(child.path)),
  );
}

export function ChangeMarker({ kind, className }: { kind: FileChangeKind; className?: string }) {
  const meta = CHANGE_META[kind];
  return (
    <span className={cn("w-3 shrink-0 text-center font-mono text-[11px] font-semibold", meta.className, className)}>
      {meta.letter}
    </span>
  );
}

function MarkerWithTooltip({ activities }: { activities: FileActivity[] }) {
  const changes = activities.flatMap((a) => (a.change ? [{ session: a.session, change: a.change }] : []));
  const latest = changes[0]?.change;
  if (!latest) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <ChangeMarker kind={latest.kind} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-72">
        <div className="space-y-1">
          {changes.map(({ session, change }) => (
            <div key={session.id} className="text-xs">
              <span className="font-medium">{CHANGE_META[change.kind].label}</span> par « {session.title} » ·{" "}
              {getHarness(session.harnessId).name} · {formatRelative(change.at)}
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function TreeRows({
  nodes,
  depth,
  projectId,
  activity,
  selectedPath,
  expanded,
  forceExpanded,
  onToggle,
}: {
  nodes: FileNode[];
  depth: number;
  projectId: string;
  activity: ProjectActivity;
  selectedPath?: string;
  expanded: Record<string, boolean>;
  forceExpanded: boolean;
  onToggle: (path: string) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const indent = { paddingLeft: depth * 12 + 8 };
        if (node.kind === "dir") {
          const open = forceExpanded || expanded[node.path];
          return (
            <div key={node.path}>
              <button
                type="button"
                onClick={() => onToggle(node.path)}
                style={indent}
                className="flex h-7 w-full items-center gap-1.5 pr-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
                {open ? <FolderOpen className="size-4 shrink-0" /> : <Folder className="size-4 shrink-0" />}
                <span className="min-w-0 flex-1 truncate">{node.name}</span>
                {!open && hasChangedDescendant(node, activity) && (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-warning/80"
                    title="Contient des fichiers modifiés"
                  />
                )}
              </button>
              {open && (
                <TreeRows
                  nodes={node.children ?? []}
                  depth={depth + 1}
                  projectId={projectId}
                  activity={activity}
                  selectedPath={selectedPath}
                  expanded={expanded}
                  forceExpanded={forceExpanded}
                  onToggle={onToggle}
                />
              )}
            </div>
          );
        }
        const Icon = FILE_ICON_BY_EXT[node.name.split(".").pop() ?? ""] ?? File;
        const activities = activity.byPath.get(node.path);
        const selected = node.path === selectedPath;
        return (
          <Link
            key={node.path}
            to={links.code(projectId, { file: node.path, view: "file" })}
            style={{ paddingLeft: depth * 12 + 28 }}
            className={cn(
              "flex h-7 items-center gap-1.5 pr-2 text-sm hover:bg-accent",
              selected
                ? "bg-primary/10 text-foreground shadow-[inset_2px_0_0_var(--color-primary)]"
                : "text-foreground/85",
            )}
          >
            <Icon className={cn("size-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
            {activities && <MarkerWithTooltip activities={activities} />}
          </Link>
        );
      })}
    </>
  );
}

function Explorer({
  projectId,
  tree,
  activity,
  selectedPath,
}: {
  projectId: string;
  tree: FileNode[];
  activity: ProjectActivity;
  selectedPath?: string;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      [
        ...tree.filter((n) => n.kind === "dir" && n.name === "src").map((n) => n.path),
        ...ancestorsOf(selectedPath ?? ""),
      ].map((p) => [p, true]),
    ),
  );

  // Reveal the selected file when it changes (e.g. jump from a trace event).
  useEffect(() => {
    if (!selectedPath) return;
    setExpanded((e) => ({ ...e, ...Object.fromEntries(ancestorsOf(selectedPath).map((p) => [p, true])) }));
  }, [selectedPath]);

  const normalized = query.trim().toLowerCase();
  const visible = useMemo(() => (normalized ? filterTree(tree, normalized) : tree), [tree, normalized]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer les fichiers…"
            aria-label="Filtrer les fichiers"
            className="h-7 pl-7 text-xs"
          />
        </div>
        <button
          type="button"
          onClick={() => setExpanded({})}
          title="Tout replier"
          aria-label="Tout replier"
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronsDownUp className="size-4" />
        </button>
      </div>
      <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Explorateur
      </div>
      <nav className="min-h-0 flex-1 overflow-auto pb-2" aria-label="Arborescence du projet">
        {visible.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">Aucun fichier ne correspond à « {query.trim()} ».</p>
        ) : (
          <TreeRows
            nodes={visible}
            depth={0}
            projectId={projectId}
            activity={activity}
            selectedPath={selectedPath}
            expanded={expanded}
            forceExpanded={normalized !== ""}
            onToggle={(path) => setExpanded((e) => ({ ...e, [path]: !e[path] }))}
          />
        )}
      </nav>
    </div>
  );
}

function AgentChanges({
  projectId,
  activity,
  selectedPath,
  selectedSessionId,
}: {
  projectId: string;
  activity: ProjectActivity;
  selectedPath?: string;
  selectedSessionId?: string;
}) {
  const [open, setOpen] = useState(true);
  const fileCount = new Set(activity.sessions.flatMap((s) => s.files.map((f) => f.path))).size;
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn("flex shrink-0 flex-col border-t border-border", open && "max-h-[50%]")}
    >
      <CollapsibleTrigger className="flex h-9 shrink-0 items-center gap-1.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <span className="flex-1">Fichiers modifiés par l'agent</span>
        <span className="tabular-nums">{fileCount}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="min-h-0 overflow-auto pb-2">
        {activity.sessions.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">Aucune session n'a modifié de fichier.</p>
        ) : (
          activity.sessions.map(({ session, files }) => (
            <div key={session.id} className="pb-1.5">
              <div className="flex items-center gap-1.5 px-3 pt-1.5 pb-1">
                <SessionStatusDot status={session.status} />
                <Link
                  to={links.session(projectId, session.id)}
                  className="min-w-0 flex-1 truncate text-xs font-medium hover:text-primary"
                  title={session.title}
                >
                  {session.title}
                </Link>
              </div>
              <div className="flex items-center gap-1.5 px-3 pb-1 pl-6 text-[11px] text-muted-foreground">
                <HarnessBadge harnessId={session.harnessId} className="h-5 px-1.5 text-[10px]" />
                <span>{formatRelative(session.startedAt)}</span>
              </div>
              {files.map(({ path, change }) => {
                const selected = path === selectedPath && session.id === selectedSessionId;
                const slash = path.lastIndexOf("/");
                return (
                  <Link
                    key={path}
                    to={links.code(projectId, { file: path, view: "diff", sessionId: session.id })}
                    className={cn(
                      "flex h-7 items-center gap-2 pr-3 pl-6 text-xs hover:bg-accent",
                      selected && "bg-primary/10 shadow-[inset_2px_0_0_var(--color-primary)]",
                    )}
                    title={path}
                  >
                    <ChangeMarker kind={change.kind} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className={cn(change.kind === "deleted" && "line-through decoration-destructive/60")}>
                        {path.slice(slash + 1)}
                      </span>
                      {slash > 0 && <span className="ml-1.5 text-muted-foreground">{path.slice(0, slash)}</span>}
                    </span>
                    <DiffStat additions={change.additions} deletions={change.deletions} />
                  </Link>
                );
              })}
            </div>
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Left column of the code workspace: file explorer + files changed by agents, grouped by session. */
export function CodeSidebar({
  projectId,
  tree,
  activity,
  selectedPath,
  selectedSessionId,
}: {
  projectId: string;
  tree: FileNode[];
  activity: ProjectActivity;
  selectedPath?: string;
  selectedSessionId?: string;
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface">
      <Explorer key={projectId} projectId={projectId} tree={tree} activity={activity} selectedPath={selectedPath} />
      <AgentChanges
        projectId={projectId}
        activity={activity}
        selectedPath={selectedPath}
        selectedSessionId={selectedSessionId}
      />
    </aside>
  );
}
