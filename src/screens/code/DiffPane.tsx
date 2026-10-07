import { Activity, FileCode2, GitCompareArrows } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HarnessBadge } from "@/components/warden/badges";
import { DiffStat, DiffView } from "@/components/warden/diff-view";
import { EmptyState } from "@/components/warden/page";
import { formatRelative, formatTime } from "@/lib/format";
import { links } from "@/lib/links";
import { getHarness, getSession } from "@/mock/queries";
import type { FileActivity } from "./model";

/** All diffs one session produced on one file, one card per file-edit event. */
export function DiffPane({
  path,
  activities,
  sessionId,
  line,
  canShowFile,
  onSelectSession,
  onShowFile,
}: {
  path: string;
  /** Activities of this file that carry diffs, newest first. */
  activities: FileActivity[];
  sessionId?: string;
  line?: number;
  canShowFile: boolean;
  onSelectSession: (sessionId: string) => void;
  onShowFile: () => void;
}) {
  const current = sessionId ? activities.find((a) => a.session.id === sessionId) : activities[0];
  const showSessionBar = activities.length > 1 || (!current && activities.length > 0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Bring DiffView's highlighted row (`line`, new side) into view whenever the shown diff changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the DOM query must re-run when path/line/session change.
  useEffect(() => {
    const row = containerRef.current?.querySelector("tr[data-highlighted]");
    if (row) row.scrollIntoView({ block: "center" });
    else containerRef.current?.scrollTo({ top: 0 });
  }, [path, line, current?.session.id]);

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-auto bg-background">
      {showSessionBar && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
          <span className="text-xs text-muted-foreground">Session</span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={current?.session.id ?? ""}
            onValueChange={(v) => v && onSelectSession(v)}
          >
            {activities.map((a) => (
              <ToggleGroupItem key={a.session.id} value={a.session.id} title={a.session.title} className="text-xs">
                {getHarness(a.session.harnessId).name} · {formatRelative(a.session.startedAt)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {current ? (
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <HarnessBadge harnessId={current.session.harnessId} />
            <Link
              to={links.session(current.session.projectId, current.session.id)}
              className="min-w-0 truncate font-medium hover:text-primary"
            >
              {current.session.title}
            </Link>
            <span className="text-xs text-muted-foreground">{formatRelative(current.session.startedAt)}</span>
          </div>
          {current.diffs.map((d, i) => (
            <div key={d.event?.id ?? i} className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="font-medium">
                  {d.event ? `Édition ${i + 1}/${current.diffs.length} · ${d.event.title}` : "Diff de fin de session"}
                </span>
                {d.event && <span className="text-muted-foreground tabular-nums">{formatTime(d.event.at)}</span>}
                <DiffStat additions={d.additions} deletions={d.deletions} />
                <span className="flex-1" />
                {d.event ? (
                  <Link
                    to={links.observeSession(current.session.id, d.event.id)}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
                  >
                    <Activity className="size-3.5" />
                    Voir dans la trace
                  </Link>
                ) : (
                  <span className="text-muted-foreground" title="Trace abrégée dans la maquette">
                    Aucun événement d'édition dans la trace
                  </span>
                )}
              </div>
              <DiffView diff={d.diff} highlightLine={line} />
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6">
          <EmptyState icon={<GitCompareArrows />} title="Aucun diff pour ce fichier dans cette session">
            {sessionId && !getSession(sessionId)
              ? `La session ${sessionId} n'existe pas dans les données de la maquette.`
              : "Cette session n'a pas modifié ce fichier."}
            {activities.length > 0 && " Choisissez une autre session ci-dessus."}
            {canShowFile && (
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={onShowFile}>
                  <FileCode2 />
                  Afficher le fichier
                </Button>
              </div>
            )}
          </EmptyState>
        </div>
      )}
    </div>
  );
}
