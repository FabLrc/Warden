import { Code2, GitCompareArrows, History, MessagesSquare } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HarnessBadge, ModelLabel, SessionStatusBadge, WorkloadBadge } from "@/components/warden/badges";
import { EmptyState, Page } from "@/components/warden/page";
import { formatDateTime } from "@/lib/format";
import { links } from "@/lib/links";
import { getAgent, getProfile, getProject, getSession, getSkill, getTrace } from "@/mock/queries";
import type { Session } from "@/mock/types";
import { EventInspector } from "./event-inspector";
import { SessionSummary } from "./session-summary";
import { TraceTimeline } from "./trace-timeline";

type ObserveTab = "summary" | "trace";

/** CDC §16–§18 — one session: summary answering P4, then the full filtered trace. */
export function SessionObserveScreen() {
  const { sessionId = "" } = useParams();
  const session = getSession(sessionId);
  if (!session) {
    return (
      <Page title="Session introuvable">
        <EmptyState icon={<History />} title={`Aucune session « ${sessionId} »`}>
          <Link to={links.history()} className="text-primary hover:underline">
            Retour à l'historique
          </Link>
        </EmptyState>
      </Page>
    );
  }
  return <SessionObserve key={session.id} session={session} />;
}

function SessionObserve({ session }: { session: Session }) {
  const trace = getTrace(session.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("event") ?? undefined;
  const selected = trace.find((e) => e.id === selectedId);
  const [tab, setTab] = useState<ObserveTab>(selected ? "trace" : "summary");

  // Selecting an event (from the summary, the inspector or an incoming `?event=` link) reveals it in the trace.
  useEffect(() => {
    if (selectedId) setTab("trace");
  }, [selectedId]);

  const selectEvent = (eventId: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("event", eventId);
        return next;
      },
      { replace: true },
    );
    setTab("trace");
  };

  const project = getProject(session.projectId);
  const agent = session.agentId ? getAgent(session.agentId) : undefined;
  const profile = session.profileId ? getProfile(session.profileId) : undefined;

  return (
    <Page
      title={session.title}
      subtitle={`${project?.name ?? session.projectId} · ${formatDateTime(session.startedAt)} · ${session.id}`}
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link to={links.session(session.projectId, session.id)}>
              <MessagesSquare />
              Conversation
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={links.code(session.projectId, { sessionId: session.id })}>
              <Code2 />
              Code
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={links.compare(session.id)}>
              <GitCompareArrows />
              Comparer
            </Link>
          </Button>
        </>
      }
      inspectorTitle="Événement"
      inspector={<EventInspector session={session} trace={trace} event={selected} onSelect={selectEvent} />}
      bodyClassName="p-0 overflow-hidden"
    >
      <Tabs value={tab} onValueChange={(value) => setTab(value as ObserveTab)} className="h-full flex-col gap-0">
        <div className="shrink-0 space-y-3 border-b border-border px-6 pt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <SessionStatusBadge status={session.status} />
            <HarnessBadge harnessId={session.harnessId} />
            <ModelLabel providerId={session.providerId} modelId={session.modelId} />
            <Meta label="Agent">{agent?.name ?? "aucun"}</Meta>
            <Meta label="Skills">
              {session.skillIds.length > 0
                ? session.skillIds.map((id) => getSkill(id)?.name ?? id).join(", ")
                : "aucun"}
            </Meta>
            <Meta label="Profil">{profile?.name ?? "aucun"}</Meta>
            <WorkloadBadge workload={session.workload} />
            {project && (
              <Link to={links.project(project.id)} className="text-muted-foreground hover:text-primary">
                Projet {project.name}
              </Link>
            )}
          </div>
          <TabsList variant="line">
            <TabsTrigger value="summary">Résumé</TabsTrigger>
            <TabsTrigger value="trace">
              Trace <span className="text-xs text-muted-foreground tabular-nums">{trace.length}</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="summary" className="min-h-0 overflow-auto p-6">
          <SessionSummary session={session} trace={trace} onSelectEvent={selectEvent} />
        </TabsContent>
        <TabsContent value="trace" className="flex min-h-0 flex-col">
          <TraceTimeline session={session} trace={trace} selectedId={selected?.id} onSelect={selectEvent} />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span>
      <span className="text-muted-foreground">{label} : </span>
      <span className="font-medium">{children}</span>
    </span>
  );
}
