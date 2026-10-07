import { FileMinus, FilePen, FilePlus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { HarnessBadge, SessionStatusDot } from "@/components/warden/badges";
import { DiffStat } from "@/components/warden/diff-view";
import { EmptyState, KeyValue, Section } from "@/components/warden/page";
import { formatDateTime, formatRelative } from "@/lib/format";
import { SESSION_STATUS_LABELS } from "@/lib/labels";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import { getAgent, getProfile, getSession, profilesForProject, skillsForProject } from "@/mock/queries";
import type { FileChangeKind, HarnessId, Project, Session, SessionStatus } from "@/mock/types";

const CHANGE_META: Record<FileChangeKind, { icon: typeof FilePen; cls: string; label: string }> = {
  added: { icon: FilePlus, cls: "text-success", label: "Ajouté" },
  modified: { icon: FilePen, cls: "text-info", label: "Modifié" },
  deleted: { icon: FileMinus, cls: "text-destructive", label: "Supprimé" },
};

export function RecentChanges({ project }: { project: Project }) {
  return (
    <Section title="Modifications récentes">
      {project.recentChanges.length === 0 ? (
        <EmptyState title="Aucune modification récente" />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {project.recentChanges.map((c) => {
            const meta = CHANGE_META[c.change];
            const Icon = meta.icon;
            const session = c.sessionId ? getSession(c.sessionId) : undefined;
            const path = <span className="truncate font-mono text-xs">{c.path}</span>;
            return (
              <li key={`${c.path}:${c.at}`} className="flex items-center gap-2.5 px-3 py-2">
                <Icon className={cn("size-4 shrink-0", meta.cls)} aria-label={meta.label} />
                <div className="min-w-0 flex-1">
                  {c.change === "deleted" && !session ? (
                    <div className="flex min-w-0 text-muted-foreground line-through">{path}</div>
                  ) : (
                    <Link
                      to={links.code(project.id, {
                        file: c.path,
                        view: session ? "diff" : "file",
                        sessionId: session?.id,
                      })}
                      className="flex min-w-0 hover:text-primary"
                      title={session ? "Voir le diff dans Code" : "Ouvrir dans Code"}
                    >
                      {path}
                    </Link>
                  )}
                  <div className="truncate text-[11px] text-muted-foreground">
                    {formatRelative(c.at)} ·{" "}
                    {session ? (
                      <Link to={links.session(project.id, session.id)} className="hover:text-primary">
                        {session.title}
                      </Link>
                    ) : (
                      "hors session"
                    )}
                  </div>
                </div>
                <DiffStat additions={c.additions} deletions={c.deletions} />
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/** CDC §8 — configurations, agents and skills used by this project. */
export function InUse({ project, sessions }: { project: Project; sessions: Session[] }) {
  const profiles = profilesForProject(project.id);
  const agentUse: Record<string, number> = {};
  for (const s of sessions) if (s.agentId) agentUse[s.agentId] = (agentUse[s.agentId] ?? 0) + 1;
  for (const p of profiles) if (p.agentId && !(p.agentId in agentUse)) agentUse[p.agentId] = 0;
  const skills = skillsForProject(project.id);
  return (
    <Section title="Dans ce projet">
      <div className="grid gap-3 md:grid-cols-3">
        <InUseCard title="Profils" to={links.profiles()}>
          {profiles.map((p) => (
            <InUseRow key={p.id} label={p.name} hint={p.scope.kind === "project" ? "projet" : "global"} />
          ))}
        </InUseCard>
        <InUseCard title="Agents" to={links.agents()}>
          {Object.entries(agentUse)
            .sort((a, b) => b[1] - a[1])
            .map(([id, count]) => (
              <InUseRow
                key={id}
                label={getAgent(id)?.name ?? id}
                hint={count > 0 ? `${count} session${count > 1 ? "s" : ""}` : "via profil"}
              />
            ))}
        </InUseCard>
        <InUseCard title="Skills" to={links.skills()}>
          {skills.map((s) => (
            <InUseRow
              key={s.id}
              label={<span className={cn("font-mono", !s.enabled && "text-muted-foreground")}>{s.name}</span>}
              hint={`${s.scope.kind === "project" ? "projet" : "global"}${s.enabled ? "" : " · désactivé"}`}
            />
          ))}
        </InUseCard>
      </div>
    </Section>
  );
}

function InUseCard({ title, to, children }: { title: string; to: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <Link to={to} className="text-xs text-muted-foreground hover:text-primary">
          Configurer
        </Link>
      </div>
      <ul>{children}</ul>
    </div>
  );
}

function InUseRow({ label, hint }: { label: ReactNode; hint: string }) {
  return (
    <li className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 text-[11px] text-muted-foreground">{hint}</span>
    </li>
  );
}

export function ShortcutCard({
  to,
  icon,
  title,
  children,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <span className="text-primary [&>svg]:size-4">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="line-clamp-2 text-xs text-muted-foreground">{children}</span>
      </span>
    </Link>
  );
}

export function ProjectFacts({ project, sessions }: { project: Project; sessions: Session[] }) {
  const profile = project.defaultProfileId ? getProfile(project.defaultProfileId) : undefined;
  const byStatus: Partial<Record<SessionStatus, number>> = {};
  for (const s of sessions) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
  const harnessIds = [...new Set<HarnessId>(sessions.map((s) => s.harnessId))];
  return (
    <div className="space-y-4">
      <div>
        <KeyValue label="Chemin">
          <span className="font-mono text-xs break-all">{project.path}</span>
        </KeyValue>
        <KeyValue label="Branche">
          <span className="font-mono text-xs">{project.branch}</span>
        </KeyValue>
        <KeyValue label="Langages">{project.languages.join(", ")}</KeyValue>
        <KeyValue label="Dernière ouverture">
          <span title={formatDateTime(project.lastOpenedAt)}>{formatRelative(project.lastOpenedAt)}</span>
        </KeyValue>
        <KeyValue label="Profil par défaut">{profile?.name ?? "Aucun"}</KeyValue>
      </div>
      <div>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sessions · {sessions.length}
        </h3>
        {(Object.keys(byStatus) as SessionStatus[]).map((status) => (
          <KeyValue
            key={status}
            label={
              <span className="inline-flex items-center gap-2">
                <SessionStatusDot status={status} />
                {SESSION_STATUS_LABELS[status]}
              </span>
            }
          >
            <span className="tabular-nums">{byStatus[status]}</span>
          </KeyValue>
        ))}
      </div>
      <div>
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Harnesses utilisés
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {harnessIds.map((id) => (
            <HarnessBadge key={id} harnessId={id} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Changer de harness ne crée pas un autre espace : toutes les sessions restent rattachées au projet.
        </p>
      </div>
      <div>
        <KeyValue label="Modifications récentes">
          <span className="tabular-nums">{project.recentChanges.length}</span>
        </KeyValue>
      </div>
    </div>
  );
}
