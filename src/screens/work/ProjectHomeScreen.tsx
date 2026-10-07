import {
  Activity,
  CirclePlay,
  Code2,
  FileQuestion,
  FlaskConical,
  GitBranch,
  GitCompareArrows,
  History,
  MessageSquare,
  Plus,
  TriangleAlert,
  Trophy,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HarnessBadge, ModelLabel, SessionStatusBadge, WorkloadBadge } from "@/components/warden/badges";
import { Markdown } from "@/components/warden/markdown";
import { ObservedValue } from "@/components/warden/observation";
import { EmptyState, KeyValue, Page, Section } from "@/components/warden/page";
import { formatCost, formatDateTime, formatDuration, formatRelative } from "@/lib/format";
import { links } from "@/lib/links";
import { getAgent, getHarness, getProject, getTrace, profilesForProject, sessionsForProject } from "@/mock/queries";
import type { Project, Session } from "@/mock/types";
import { InUse, ProjectFacts, RecentChanges, ShortcutCard } from "@/screens/work/project-home-sections";

/** CDC §8 — everything the user finds when opening a project. */
export function ProjectHomeScreen() {
  const { projectId = "" } = useParams();
  const project = getProject(projectId);
  if (!project) {
    return (
      <Page title="Projet introuvable">
        <EmptyState icon={<FileQuestion />} title={`Aucun projet « ${projectId} »`}>
          <Link to={links.projects()} className="text-primary hover:underline">
            Voir tous les projets
          </Link>
        </EmptyState>
      </Page>
    );
  }
  return <ProjectHome project={project} />;
}

function ProjectHome({ project }: { project: Project }) {
  const sessions = sessionsForProject(project.id);
  const resumable = sessions.find((s) => s.resumable);
  return (
    <Page
      title={project.name}
      subtitle={
        <span className="inline-flex items-center gap-3">
          <span className="font-mono">{project.path}</span>
          <span className="inline-flex items-center gap-1 font-mono">
            <GitBranch className="size-3" />
            {project.branch}
          </span>
        </span>
      }
      actions={
        <>
          <Button size="sm" variant="outline" asChild>
            <Link to={links.code(project.id)}>
              <Code2 /> Code
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to={links.newSession(project.id)}>
              <Plus /> Nouvelle session
            </Link>
          </Button>
        </>
      }
      inspectorTitle="Projet"
      inspector={<ProjectFacts project={project} sessions={sessions} />}
    >
      <div className="mx-auto max-w-6xl space-y-8">
        <p className="text-sm text-muted-foreground">{project.description}</p>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {resumable ? (
            <ResumeCard project={project} session={resumable} />
          ) : (
            <EmptyState icon={<History />} title="Aucune session à reprendre">
              Les harnesses utilisés jusqu'ici ne permettent pas de reprendre les sessions de ce projet.
            </EmptyState>
          )}
          <QuickStart project={project} />
        </div>

        <SessionsTable project={project} sessions={sessions} />

        <div className="grid gap-8 lg:grid-cols-2">
          <RecentChanges project={project} />
          <Section title="Préférences du projet">
            <div className="rounded-lg border border-border bg-card px-4 py-2">
              {project.preferences.map((p) => (
                <KeyValue key={p.label} label={p.label}>
                  {p.value}
                </KeyValue>
              ))}
            </div>
          </Section>
        </div>

        <InUse project={project} sessions={sessions} />

        <Section title="Benchmarks et observabilité">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ShortcutCard to={links.lab()} icon={<FlaskConical />} title="Lab">
              Expériences et benchmarks lancés sur ce dépôt.
            </ShortcutCard>
            <ShortcutCard to={links.rankings()} icon={<Trophy />} title="Rankings">
              Meilleures configurations selon vos propres runs.
            </ShortcutCard>
            <ShortcutCard to={links.history()} icon={<Activity />} title="Historique Observe">
              Traces, tokens, coûts et temps de toutes les sessions.
            </ShortcutCard>
            {sessions.length >= 2 && (
              <ShortcutCard
                to={links.compare(sessions[0].id, sessions[1].id)}
                icon={<GitCompareArrows />}
                title="Comparer les 2 dernières"
              >
                {sessions[0].title} ↔ {sessions[1].title}
              </ShortcutCard>
            )}
          </div>
        </Section>
      </div>
    </Page>
  );
}

/** P1 — the most recent resumable session, one click away. */
function ResumeCard({ project, session }: { project: Project; session: Session }) {
  const navigate = useNavigate();
  const lastMessage = getTrace(session.id)
    .filter((e) => e.kind === "assistant-message" && e.text)
    .at(-1)?.text;
  const agent = session.agentId ? getAgent(session.agentId) : undefined;
  return (
    <section className="glow-soul flex flex-col gap-3 rounded-lg border border-primary/40 bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
        <CirclePlay className="size-3.5" /> Reprendre là où vous vous êtes arrêté
      </div>
      <div>
        <Link
          to={links.session(project.id, session.id)}
          className="text-base font-semibold hover:text-primary hover:underline"
        >
          {session.title}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <HarnessBadge harnessId={session.harnessId} className="h-5" />
          <ModelLabel providerId={session.providerId} modelId={session.modelId} />
          {agent && <span>· Agent {agent.name}</span>}
          <SessionStatusBadge status={session.status} />
          <span title={formatDateTime(session.startedAt)}>{formatRelative(session.startedAt)}</span>
        </div>
      </div>
      {lastMessage && (
        <div className="relative max-h-28 overflow-hidden rounded-md border border-border bg-surface px-3 py-2">
          <Markdown className="text-xs text-muted-foreground">{lastMessage}</Markdown>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-surface" />
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button onClick={() => navigate(links.session(project.id, session.id), { state: { resume: true } })}>
          <CirclePlay /> Reprendre
        </Button>
        <Button variant="outline" asChild>
          <Link to={links.session(project.id, session.id)}>
            <MessageSquare /> Voir la conversation
          </Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link to={links.observeSession(session.id)}>
            <Activity /> Observer
          </Link>
        </Button>
        {session.filesChanged.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {session.filesChanged.length} fichier{session.filesChanged.length > 1 ? "s" : ""} modifié
            {session.filesChanged.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </section>
  );
}

/** CDC §12 — profiles selected at launch. */
function QuickStart({ project }: { project: Project }) {
  const profiles = profilesForProject(project.id);
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Démarrer avec un profil
        </h2>
        <Link to={links.profiles()} className="text-xs text-muted-foreground hover:text-primary">
          Gérer
        </Link>
      </div>
      <ul className="space-y-1.5">
        {profiles.map((p) => {
          const harness = getHarness(p.harnessId);
          return (
            <li key={p.id}>
              <Link
                to={links.newSession(project.id, p.id)}
                className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2 transition-colors hover:border-primary/50 hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {p.name}
                    {p.id === project.defaultProfileId && (
                      <span className="rounded border border-primary/40 px-1 text-[10px] font-normal text-primary">
                        par défaut
                      </span>
                    )}
                    {p.scope.kind === "project" && (
                      <span className="rounded border border-border px-1 text-[10px] font-normal text-muted-foreground">
                        projet
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <HarnessBadge harnessId={p.harnessId} className="h-5" />
                    <ModelLabel providerId={p.providerId} modelId={p.modelId} />
                  </div>
                </div>
                {!harness.installed && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-warning">
                    <TriangleAlert className="size-3.5" /> {harness.name} non installé
                  </span>
                )}
                <Plus className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SessionsTable({ project, sessions }: { project: Project; sessions: Session[] }) {
  return (
    <Section
      title={`Sessions · ${sessions.length}`}
      actions={
        <Link to={links.history()} className="text-xs text-muted-foreground hover:text-primary">
          Tout l'historique
        </Link>
      }
    >
      {sessions.length === 0 ? (
        <EmptyState icon={<MessageSquare />} title="Aucune session dans ce projet" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Session</TableHead>
                <TableHead>Harness</TableHead>
                <TableHead>Modèle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Durée</TableHead>
                <TableHead className="text-right">Coût</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => {
                const agent = s.agentId ? getAgent(s.agentId) : undefined;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-80 pl-4">
                      <Link
                        to={links.session(project.id, s.id)}
                        className="block truncate font-medium hover:text-primary"
                        title={s.title}
                      >
                        {s.title}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span title={formatDateTime(s.startedAt)}>{formatRelative(s.startedAt)}</span>
                        {agent && <span>· {agent.name}</span>}
                        <WorkloadBadge workload={s.workload} />
                      </div>
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
                    <TableCell className="text-right">
                      <ObservedValue obs={s.metrics.durationMs} format={formatDuration} hideBadge />
                    </TableCell>
                    <TableCell className="text-right">
                      <ObservedValue obs={s.metrics.cost} format={formatCost} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" asChild>
                        <Link
                          to={links.observeSession(s.id)}
                          title="Observer la session"
                          aria-label={`Observer ${s.title}`}
                        >
                          <Activity />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  );
}
