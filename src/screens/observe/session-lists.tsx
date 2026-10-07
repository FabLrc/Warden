import type { ReactNode } from "react";
import { DiffStat } from "@/components/warden/diff-view";
import { Section } from "@/components/warden/page";
import { TraceKindIcon } from "@/components/warden/trace-meta";
import { formatDuration, formatNumber } from "@/lib/format";
import { PERMISSION_DECISION_LABELS, PERMISSION_KIND_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { FileChangeKind, Session, TraceEvent } from "@/mock/types";
import { formatOffset, isError, offsetMs } from "./analysis";
import { FileLink } from "./observe-ui";

const CHANGE_LABELS: Record<FileChangeKind, { label: string; cls: string }> = {
  added: { label: "ajouté", cls: "text-success" },
  modified: { label: "modifié", cls: "text-info" },
  deleted: { label: "supprimé", cls: "text-destructive" },
};

interface ListProps {
  session: Session;
  trace: TraceEvent[];
  onSelectEvent: (eventId: string) => void;
}

/** CDC §16 — files read and modified, commands, errors and permissions of one session. */
export function SessionLists(props: ListProps) {
  return (
    <div className="grid gap-x-8 gap-y-6 xl:grid-cols-2">
      <FilesChangedList {...props} />
      <FilesReadList {...props} />
      <CommandsList {...props} />
      <ErrorsList {...props} />
      <PermissionsList {...props} />
    </div>
  );
}

// ── Lists ──────────────────────────────────────────────────────────────────

function ListSection({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <Section
      title={
        <span>
          {title} <span className="font-normal tabular-nums">({formatNumber(count)})</span>
        </span>
      }
    >
      {count === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
          {empty}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">{children}</ul>
      )}
    </Section>
  );
}

function EventRow({
  event,
  session,
  onSelectEvent,
  children,
}: {
  event: TraceEvent;
  session: Session;
  onSelectEvent: (eventId: string) => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelectEvent(event.id)}
        className="flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent/50"
        title="Voir dans la trace"
      >
        <TraceKindIcon kind={event.kind} className="mt-0.5" />
        <div className="min-w-0 flex-1">{children}</div>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
          {formatOffset(offsetMs(session, event))}
        </span>
      </button>
    </li>
  );
}

function FilesChangedList({ session, trace, onSelectEvent }: ListProps) {
  return (
    <ListSection title="Fichiers modifiés" count={session.filesChanged.length} empty="Aucun fichier modifié.">
      {session.filesChanged.map((f) => {
        const edit = trace.find((e) => e.kind === "file-edit" && e.file?.path === f.path);
        return (
          <li key={f.path} className="flex items-center gap-3 px-3 py-2">
            <FileLink
              projectId={session.projectId}
              sessionId={session.id}
              file={{ path: f.path, line: edit?.file?.line }}
              view="diff"
              className="flex-1"
            />
            <span className={cn("text-[11px]", CHANGE_LABELS[f.change].cls)}>{CHANGE_LABELS[f.change].label}</span>
            <DiffStat additions={f.additions} deletions={f.deletions} />
            {edit && (
              <button
                type="button"
                onClick={() => onSelectEvent(edit.id)}
                className="text-[11px] text-muted-foreground hover:text-primary"
              >
                trace
              </button>
            )}
          </li>
        );
      })}
    </ListSection>
  );
}

function FilesReadList({ session, trace, onSelectEvent }: ListProps) {
  const reads = trace.filter((e) => e.kind === "file-read");
  return (
    <ListSection title="Fichiers lus" count={reads.length} empty="Aucune lecture de fichier dans la trace.">
      {reads.map((e) => (
        <li key={e.id} className="flex items-center gap-3 px-3 py-2">
          <TraceKindIcon kind={e.kind} />
          {e.file ? (
            <FileLink
              projectId={session.projectId}
              sessionId={session.id}
              file={e.file}
              view="file"
              className="flex-1"
            />
          ) : (
            <span className="flex-1 truncate text-xs">{e.title}</span>
          )}
          <button
            type="button"
            onClick={() => onSelectEvent(e.id)}
            className="font-mono text-[11px] text-muted-foreground tabular-nums hover:text-primary"
            title="Voir dans la trace"
          >
            {formatOffset(offsetMs(session, e))}
          </button>
        </li>
      ))}
    </ListSection>
  );
}

function CommandsList({ session, trace, onSelectEvent }: ListProps) {
  const commands = trace.filter((e) => e.command);
  return (
    <ListSection title="Commandes exécutées" count={commands.length} empty="Aucune commande exécutée.">
      {commands.map((e) => (
        <EventRow key={e.id} event={e} session={session} onSelectEvent={onSelectEvent}>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{e.command}</code>
            {e.durationMs !== undefined && (
              <span className="text-[11px] text-muted-foreground tabular-nums">{formatDuration(e.durationMs)}</span>
            )}
            <span
              className={cn(
                "rounded border px-1.5 font-mono text-[11px] tabular-nums",
                e.exitCode === undefined
                  ? "border-border text-muted-foreground"
                  : e.exitCode === 0
                    ? "border-success/35 text-success"
                    : "border-destructive/35 text-destructive",
              )}
              title={e.exitCode === undefined ? "Code de sortie non rapporté (outil interne)" : "Code de sortie"}
            >
              exit {e.exitCode ?? "—"}
            </span>
          </div>
        </EventRow>
      ))}
    </ListSection>
  );
}

function ErrorsList({ session, trace, onSelectEvent }: ListProps) {
  const errors = trace.filter(isError);
  return (
    <ListSection title="Erreurs" count={errors.length} empty="Aucune erreur dans la trace.">
      {errors.map((e) => (
        <EventRow key={e.id} event={e} session={session} onSelectEvent={onSelectEvent}>
          <div className="truncate">{e.title}</div>
          {e.output && (
            <div className="truncate font-mono text-[11px] text-destructive/90">
              {e.output.split("\n").find((line) => line.trim()) ?? ""}
            </div>
          )}
        </EventRow>
      ))}
    </ListSection>
  );
}

function PermissionsList({ session, trace, onSelectEvent }: ListProps) {
  const permissions = trace.filter((e) => e.kind === "permission-request" && e.permission);
  return (
    <ListSection title="Permissions demandées" count={permissions.length} empty="Aucune permission demandée.">
      {permissions.map((e) =>
        e.permission ? (
          <EventRow key={e.id} event={e} session={session} onSelectEvent={onSelectEvent}>
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{e.title}</span>
              <span className="rounded border border-border px-1.5 text-[11px] text-muted-foreground">
                {PERMISSION_KIND_LABELS[e.permission.kind]}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  e.permission.decision === "deny"
                    ? "text-destructive"
                    : e.permission.decision
                      ? "text-success"
                      : "text-warning",
                )}
              >
                {e.permission.decision ? PERMISSION_DECISION_LABELS[e.permission.decision] : "En attente"}
              </span>
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {e.durationMs !== undefined && <>Attente : {formatDuration(e.durationMs)} · </>}
              {e.permission.reason}
            </div>
          </EventRow>
        ) : null,
      )}
    </ListSection>
  );
}
