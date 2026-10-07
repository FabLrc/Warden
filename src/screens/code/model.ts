import { sessionDiffs } from "@/mock/fixtures/code";
import { getTrace, sessionsForProject } from "@/mock/queries";
import type { FileChangeKind, Session, TraceEvent } from "@/mock/types";

export interface FileDiff {
  /** Trace event that produced the diff; absent for the end-of-session diff of abridged traces. */
  event?: TraceEvent;
  diff: string;
  additions: number;
  deletions: number;
  /** New-file line numbers added by the diff. */
  addedLines: number[];
}

export interface FileChangeSummary {
  kind: FileChangeKind;
  additions: number;
  deletions: number;
  at: string;
}

/** What one session did to one file. */
export interface FileActivity {
  session: Session;
  /** Undefined when the session only read the file. */
  change?: FileChangeSummary;
  diffs: FileDiff[];
  reads: TraceEvent[];
}

export interface SessionChanges {
  session: Session;
  files: { path: string; change: FileChangeSummary }[];
}

export interface ProjectActivity {
  /** path → activities, newest session first. */
  byPath: Map<string, FileActivity[]>;
  /** Sessions that changed files, newest first. */
  sessions: SessionChanges[];
}

export function parseDiff(diff: string): Omit<FileDiff, "event" | "diff"> {
  let additions = 0;
  let deletions = 0;
  let newNo = 0;
  const addedLines: number[] = [];
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("@@")) {
      newNo = Number(/\+(\d+)/.exec(line)?.[1] ?? 0);
    } else if (line.startsWith("+")) {
      additions++;
      addedLines.push(newNo++);
    } else if (line.startsWith("-")) {
      deletions++;
    } else {
      newNo++;
    }
  }
  return { additions, deletions, addedLines };
}

/**
 * Agent activity per file, derived from sessions' `filesChanged` and trace file-read / file-edit events.
 * Diffs come from the trace; sessions with an abridged trace fall back to their recorded session diff.
 */
export function projectActivity(projectId: string): ProjectActivity {
  const byPath = new Map<string, FileActivity[]>();
  const sessions: SessionChanges[] = [];
  for (const session of sessionsForProject(projectId)) {
    const perPath = new Map<string, FileActivity>();
    const activityFor = (path: string): FileActivity => {
      let activity = perPath.get(path);
      if (!activity) {
        activity = { session, diffs: [], reads: [] };
        perPath.set(path, activity);
      }
      return activity;
    };
    for (const fc of session.filesChanged) {
      activityFor(fc.path).change = { kind: fc.change, additions: fc.additions, deletions: fc.deletions, at: fc.at };
    }
    for (const event of getTrace(session.id)) {
      if (!event.file) continue;
      if (event.kind === "file-read") activityFor(event.file.path).reads.push(event);
      if (event.kind === "file-edit" && event.diff) {
        activityFor(event.file.path).diffs.push({ event, diff: event.diff, ...parseDiff(event.diff) });
      }
    }
    const files: SessionChanges["files"] = [];
    for (const [path, activity] of perPath) {
      const recorded = sessionDiffs[session.id]?.[path];
      if (activity.diffs.length === 0 && recorded) activity.diffs.push({ diff: recorded, ...parseDiff(recorded) });
      if (activity.change) files.push({ path, change: activity.change });
      const list = byPath.get(path);
      if (list) list.push(activity);
      else byPath.set(path, [activity]);
    }
    if (files.length > 0) sessions.push({ session, files });
  }
  return { byPath, sessions };
}

/** Change shown on the explorer: the most recent session that changed the file. */
export function latestChange(activities: FileActivity[] | undefined): FileActivity | undefined {
  return activities?.find((a) => a.change);
}

export const CHANGE_META: Record<FileChangeKind, { letter: string; label: string; className: string }> = {
  added: { letter: "A", label: "Ajouté", className: "text-success" },
  modified: { letter: "M", label: "Modifié", className: "text-warning" },
  deleted: { letter: "D", label: "Supprimé", className: "text-destructive" },
};
