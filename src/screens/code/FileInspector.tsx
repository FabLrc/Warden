import { Activity, BookOpen, GitCompareArrows, Pencil } from "lucide-react";
import { Link } from "react-router";
import { HarnessBadge, SessionStatusDot } from "@/components/warden/badges";
import { DiffStat } from "@/components/warden/diff-view";
import { KeyValue, Section } from "@/components/warden/page";
import { formatNumber, formatRelative, formatTime } from "@/lib/format";
import { links } from "@/lib/links";
import type { Project } from "@/mock/types";
import { ChangeMarker } from "./CodeSidebar";
import { languageOf } from "./highlight";
import { CHANGE_META, type FileActivity, latestChange, type ProjectActivity } from "./model";

/** [18, 19, 20, 27] → [[18, 20], [27, 27]] */
function toRanges(lines: number[]): [number, number][] {
  const ranges: [number, number][] = [];
  for (const n of [...new Set(lines)].sort((a, b) => a - b)) {
    const last = ranges.at(-1);
    if (last && n === last[1] + 1) last[1] = n;
    else ranges.push([n, n]);
  }
  return ranges;
}

function ActivityCard({
  projectId,
  path,
  activity,
  fileExists,
}: {
  projectId: string;
  path: string;
  activity: FileActivity;
  fileExists: boolean;
}) {
  const { session, change, diffs, reads } = activity;
  const ranges = fileExists ? toRanges(diffs.flatMap((d) => d.addedLines)) : [];
  const events = [
    ...diffs.flatMap((d) => (d.event ? [{ event: d.event, icon: Pencil, label: "Édition" }] : [])),
    ...reads.map((event) => ({ event, icon: BookOpen, label: "Lecture" })),
  ].sort((a, b) => a.event.at.localeCompare(b.event.at));

  return (
    <div className="space-y-2.5 rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <span className="mt-1.5">
          <SessionStatusDot status={session.status} />
        </span>
        <Link
          to={links.session(projectId, session.id)}
          className="text-sm font-medium leading-snug hover:text-primary"
          title="Ouvrir la conversation"
        >
          {session.title}
        </Link>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <HarnessBadge harnessId={session.harnessId} className="h-5 px-1.5 text-[10px]" />
        <span>{formatRelative(session.startedAt)}</span>
      </div>

      {change ? (
        <div className="flex items-center gap-2 text-xs">
          <ChangeMarker kind={change.kind} />
          <span>{CHANGE_META[change.kind].label}</span>
          <DiffStat additions={change.additions} deletions={change.deletions} />
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Lu sans modification</div>
      )}

      {ranges.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] text-muted-foreground">Lignes ajoutées ou modifiées</div>
          <div className="flex flex-wrap gap-1">
            {ranges.map(([start, end]) => (
              <Link
                key={start}
                to={links.code(projectId, { file: path, line: start, view: "file", sessionId: session.id })}
                className="rounded border border-border bg-secondary/60 px-1.5 font-mono text-[11px] tabular-nums hover:border-primary/60 hover:text-primary"
              >
                {start === end ? start : `${start}–${end}`}
              </Link>
            ))}
          </div>
        </div>
      )}

      {events.length > 0 && (
        <ul className="space-y-0.5">
          {events.map(({ event, icon: Icon, label }) => (
            <li key={event.id}>
              <Link
                to={links.observeSession(session.id, event.id)}
                className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Voir l'événement dans la trace"
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="flex-1">
                  {label}
                  {event.file?.line !== undefined && ` · ligne ${event.file.line}`}
                </span>
                <span className="tabular-nums">{formatTime(event.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2 text-xs">
        {diffs.length > 0 && (
          <Link
            to={links.code(projectId, { file: path, view: "diff", sessionId: session.id })}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
          >
            <GitCompareArrows className="size-3.5" />
            Voir le diff
          </Link>
        )}
        <Link
          to={links.observeSession(session.id)}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
        >
          <Activity className="size-3.5" />
          Observer la session
        </Link>
      </div>
    </div>
  );
}

export function FileInspector({
  projectId,
  path,
  content,
  activities,
}: {
  projectId: string;
  path: string;
  content?: string;
  activities?: FileActivity[];
}) {
  const bytes = content === undefined ? 0 : new TextEncoder().encode(content).length;
  const state =
    content === undefined ? "Supprimé" : latestChange(activities) ? "Modifié par un agent" : "Non modifié par un agent";
  return (
    <div className="space-y-6">
      <Section title="Fichier">
        <div>
          <KeyValue label="Chemin">
            <span className="break-all font-mono text-xs">{path}</span>
          </KeyValue>
          <KeyValue label="Langage">{languageOf(path).label}</KeyValue>
          {content !== undefined && (
            <>
              <KeyValue label="Lignes">
                <span className="tabular-nums">{formatNumber(content.replace(/\n$/, "").split("\n").length)}</span>
              </KeyValue>
              <KeyValue label="Taille">
                <span className="tabular-nums">
                  {bytes < 1024
                    ? `${bytes} o`
                    : `${(bytes / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Ko`}
                </span>
              </KeyValue>
            </>
          )}
          <KeyValue label="État">{state}</KeyValue>
        </div>
      </Section>
      <Section title="Sessions">
        {activities && activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((a) => (
              <ActivityCard
                key={a.session.id}
                projectId={projectId}
                path={path}
                activity={a}
                fileExists={content !== undefined}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Aucune session n'a lu ni modifié ce fichier.</p>
        )}
      </Section>
    </div>
  );
}

export function ProjectCodeSummary({
  project,
  fileCount,
  activity,
}: {
  project: Project;
  fileCount: number;
  activity: ProjectActivity;
}) {
  const changed = [...activity.byPath.values()].filter((list) => latestChange(list)).length;
  return (
    <div className="space-y-6">
      <Section title="Projet">
        <div>
          <KeyValue label="Nom">{project.name}</KeyValue>
          <KeyValue label="Chemin">
            <span className="break-all font-mono text-xs">{project.path}</span>
          </KeyValue>
          <KeyValue label="Branche">
            <span className="font-mono text-xs">{project.branch}</span>
          </KeyValue>
          <KeyValue label="Fichiers">
            <span className="tabular-nums">{fileCount}</span>
          </KeyValue>
          <KeyValue label="Modifiés par un agent">
            <span className="tabular-nums">{changed}</span>
          </KeyValue>
          <KeyValue label="Sessions avec modifications">
            <span className="tabular-nums">{activity.sessions.length}</span>
          </KeyValue>
        </div>
      </Section>
      <p className="text-xs text-muted-foreground">
        Le mode code est en lecture seule : explorer, lire, consulter les diffs produits par les agents et revenir à la
        trace. L'édition se fait dans votre éditeur.
      </p>
    </div>
  );
}
