import { Activity, CirclePlay, FileQuestion, History, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HarnessBadge, ModelLabel, SessionStatusBadge } from "@/components/warden/badges";
import { EmptyState, Page } from "@/components/warden/page";
import { formatRelative } from "@/lib/format";
import { INTEGRATION_LABELS, SUPPORT_LABELS } from "@/lib/labels";
import { links } from "@/lib/links";
import { getAgent, getHarness, getProject, getSession, getTrace } from "@/mock/queries";
import { useReplay } from "@/mock/replay";
import type { Project, Session } from "@/mock/types";
import { Composer } from "@/screens/work/composer";
import { Conversation, type ConversationLinks } from "@/screens/work/conversation";
import { NewSession } from "@/screens/work/new-session";
import { liveFiles, useAutoScroll, useEscapeToInterrupt } from "@/screens/work/session-hooks";
import { SessionInspector } from "@/screens/work/session-inspector";

/** Conversation view (CDC §9, §19, §30): `sessions/new` starts a session, `sessions/:sessionId` opens one. */
export function SessionScreen() {
  const { projectId = "", sessionId } = useParams();
  const [params] = useSearchParams();
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
  if (!sessionId) {
    const profileId = params.get("profile") ?? project.defaultProfileId;
    return <NewSession key={`${project.id}:${profileId ?? ""}`} project={project} initialProfileId={profileId} />;
  }
  const session = getSession(sessionId);
  if (!session || session.projectId !== project.id) {
    return (
      <Page title="Session introuvable">
        <EmptyState icon={<FileQuestion />} title={`Aucune session « ${sessionId} » dans ${project.name}`}>
          <Link to={links.project(project.id)} className="text-primary hover:underline">
            Retour au projet
          </Link>
        </EmptyState>
      </Page>
    );
  }
  return <ExistingSession key={session.id} project={project} session={session} />;
}

function ExistingSession({ project, session }: { project: Project; session: Session }) {
  const location = useLocation();
  const harness = getHarness(session.harnessId);
  const agent = session.agentId ? getAgent(session.agentId) : undefined;
  const trace = getTrace(session.id);
  const replay = useReplay(session.id);
  const [resumed, setResumed] = useState(() => {
    const state = location.state as { resume?: boolean } | null;
    return session.resumable && state?.resume === true;
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { scrollRef, contentRef, onScroll } = useAutoScroll();
  useEscapeToInterrupt(replay.active, replay.interrupt);
  useEffect(() => {
    if (resumed) textareaRef.current?.focus();
  }, [resumed]);

  const recorded = new Set(trace.map((e) => e.id));
  const conversationLinks: ConversationLinks = {
    code: (e) =>
      recorded.has(e.id)
        ? links.code(project.id, {
            file: e.file?.path,
            line: e.file?.line,
            view: e.kind === "file-edit" ? "diff" : "file",
            sessionId: session.id,
          })
        : links.code(project.id, { file: e.file?.path, line: e.file?.line, view: "file" }),
    observe: (e) => (recorded.has(e.id) ? links.observeSession(session.id, e.id) : undefined),
  };
  const events = [...trace, ...replay.events];
  const status = replay.status === "idle" ? session.status : replay.status;
  const resume = harness.capabilities.resume;
  const cannotResume = `${harness.name} ne permet pas de reprendre cette session (reprise : ${SUPPORT_LABELS[resume.support].toLowerCase()}${resume.note ? ` — ${resume.note}` : ""}).`;

  const startResume = () => {
    setResumed(true);
    textareaRef.current?.focus();
  };

  return (
    <Page
      title={session.title}
      subtitle={
        <span className="inline-flex items-center gap-2 py-0.5">
          <HarnessBadge harnessId={session.harnessId} className="h-5" />
          <ModelLabel providerId={session.providerId} modelId={session.modelId} />
          {agent && <span className="text-xs">· Agent {agent.name}</span>}
          <SessionStatusBadge status={status} />
          <span className="text-xs">{formatRelative(session.startedAt)}</span>
        </span>
      }
      actions={
        <>
          {replay.active && (
            <Button size="sm" variant="destructive" onClick={replay.interrupt} title="Interrompre (Échap)">
              <Square className="fill-current" /> Interrompre
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <Link to={links.observeSession(session.id)}>
              <Activity /> Observer
            </Link>
          </Button>
          {session.resumable ? (
            <Button size="sm" onClick={startResume} disabled={replay.active}>
              <CirclePlay /> Reprendre
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="sm" disabled>
                    <CirclePlay /> Reprendre
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-72">{cannotResume}</TooltipContent>
            </Tooltip>
          )}
        </>
      }
      inspector={
        <SessionInspector
          config={session}
          metrics={session.metrics}
          metricsTitle="Métriques de la session"
          live={replay.metrics}
          files={[
            ...session.filesChanged.map((f) => ({
              path: f.path,
              additions: f.additions,
              deletions: f.deletions,
              href: links.code(project.id, { file: f.path, view: "diff", sessionId: session.id }),
            })),
            ...liveFiles(project.id, replay.events),
          ]}
          permissions={events.filter((e) => e.kind === "permission-request")}
          observeHref={links.observeSession(session.id)}
        />
      }
      bodyClassName="flex flex-col p-0 overflow-hidden"
    >
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto px-6 py-6">
        <div ref={contentRef}>
          <Conversation
            events={events}
            links={conversationLinks}
            streaming={replay.active}
            onPermission={replay.answer}
          />
        </div>
      </div>
      <Composer
        textareaRef={textareaRef}
        active={replay.active}
        disabled={!session.resumable}
        onInterrupt={replay.interrupt}
        onSend={(prompt) => {
          setResumed(true);
          replay.send(prompt, {
            projectId: project.id,
            harnessId: session.harnessId,
            providerId: session.providerId,
            modelId: session.modelId,
            agentId: session.agentId,
            resumed: true,
          });
        }}
        placeholder={session.resumable ? "Continuer la session…" : "Cette session ne peut pas être reprise"}
        sendLabel={replay.status === "idle" ? "Reprendre" : "Envoyer"}
        notice={
          !session.resumable ? (
            <Alert>
              <History />
              <AlertTitle>Session non reprenable</AlertTitle>
              <AlertDescription>
                {cannotResume}{" "}
                <Link
                  to={links.newSession(project.id, session.profileId)}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Démarrer une nouvelle session
                </Link>
              </AlertDescription>
            </Alert>
          ) : (
            resumed &&
            replay.status === "idle" && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CirclePlay className="size-3.5 text-primary" />
                Reprise avec {harness.name} ({INTEGRATION_LABELS[harness.integration]}) : le contexte de la session est
                rechargé, vous continuez là où elle s'est arrêtée.
                {resume.support === "partial" && resume.note && <span className="text-warning">{resume.note}</span>}
              </p>
            )
          )
        }
        toolbar={
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <HarnessBadge harnessId={session.harnessId} className="h-5" />
            <ModelLabel providerId={session.providerId} modelId={session.modelId} />
          </span>
        }
      />
    </Page>
  );
}
