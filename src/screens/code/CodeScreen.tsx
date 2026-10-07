import { Check, ChevronRight, Code2, Copy, ExternalLink, FileCode2, FileX2, GitCompareArrows } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DiffStat } from "@/components/warden/diff-view";
import { EmptyState, Page } from "@/components/warden/page";
import { formatRelative } from "@/lib/format";
import { links } from "@/lib/links";
import { fileContents, fileTrees } from "@/mock/fixtures/code";
import { getHarness, getProject } from "@/mock/queries";
import { ChangeMarker, CodeSidebar } from "./CodeSidebar";
import { DiffPane } from "./DiffPane";
import { FileInspector, ProjectCodeSummary } from "./FileInspector";
import { FileViewer } from "./FileViewer";
import { latestChange, type ProjectActivity, projectActivity } from "./model";

type View = "file" | "diff";

function ExternalEditorDialog({ location }: { location: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <ExternalLink />
          Ouvrir dans l'éditeur externe
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ouvrir dans l'éditeur externe</DialogTitle>
          <DialogDescription>
            Warden ouvrira cet emplacement dans l'éditeur configuré (VS Code, Zed, JetBrains…). Le mode code reste en
            lecture seule : l'édition se fait dans votre éditeur.
          </DialogDescription>
        </DialogHeader>
        <pre className="overflow-x-auto rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs">
          code --goto {location}
        </pre>
        <p className="text-xs text-muted-foreground">
          Non disponible dans la maquette : aucune commande n'est exécutée.
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Fermer</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyPathButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Copier le chemin"
          onClick={() => navigator.clipboard.writeText(path).then(() => setCopied(true))}
        >
          {copied ? <Check className="text-success" /> : <Copy />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? "Chemin copié" : "Copier le chemin"}</TooltipContent>
    </Tooltip>
  );
}

function Breadcrumb({ projectName, path }: { projectName: string; path: string }) {
  const parts = path.split("/");
  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-hidden text-sm" aria-label="Chemin du fichier">
      <span className="min-w-0 truncate text-muted-foreground">{projectName}</span>
      {parts.map((part, i) => {
        const last = i === parts.length - 1;
        return (
          <span
            key={parts.slice(0, i + 1).join("/")}
            className={last ? "flex shrink-0 items-center gap-1" : "flex min-w-0 items-center gap-1"}
          >
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
            <span className={last ? "font-medium" : "truncate text-muted-foreground"}>{part}</span>
          </span>
        );
      })}
    </nav>
  );
}

export function CodeScreen() {
  const { projectId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const activity = useMemo(() => projectActivity(projectId), [projectId]);
  const project = getProject(projectId);

  if (!project) {
    return (
      <Page title="Code">
        <EmptyState icon={<Code2 />} title="Projet introuvable">
          <Link to={links.projects()} className="text-primary hover:underline">
            Retour aux projets
          </Link>
        </EmptyState>
      </Page>
    );
  }

  const files = fileContents[projectId] ?? {};
  const tree = fileTrees[projectId] ?? [];
  const file = params.get("file") ?? undefined;
  const lineParam = Number(params.get("line"));
  const line = Number.isInteger(lineParam) && lineParam > 0 ? lineParam : undefined;
  const sessionId = params.get("session") ?? undefined;
  const content = file ? files[file] : undefined;
  const activities = file ? activity.byPath.get(file) : undefined;
  const withDiffs = activities?.filter((a) => a.diffs.length > 0) ?? [];
  const view: View = params.get("view") === "diff" || (file && content === undefined) ? "diff" : "file";
  const go = (patch: { line?: number; view?: View; sessionId?: string }) =>
    navigate(links.code(projectId, { file, line, view, sessionId, ...patch }), { replace: true });

  // Gutter marks in file view: lines added by the selected session, else by the latest session that changed the file.
  const markedActivity = (sessionId && withDiffs.find((a) => a.session.id === sessionId)) || latestChange(withDiffs);
  const changedLines = new Set(markedActivity?.diffs.flatMap((d) => d.addedLines));

  const subtitle = `${project.name} · ${project.branch} · lecture seule`;
  const inspector = file ? (
    <FileInspector projectId={projectId} path={file} content={content} activities={activities} />
  ) : (
    <ProjectCodeSummary project={project} fileCount={Object.keys(files).length} activity={activity} />
  );

  return (
    <Page
      title="Code"
      subtitle={subtitle}
      inspector={inspector}
      inspectorTitle={file ? "Fichier" : "Projet"}
      bodyClassName="p-0 overflow-hidden"
    >
      <div className="flex h-full min-h-0">
        <CodeSidebar
          projectId={projectId}
          tree={tree}
          activity={activity}
          selectedPath={file}
          selectedSessionId={view === "diff" ? (sessionId ?? withDiffs[0]?.session.id) : undefined}
        />
        <section className="flex min-w-0 flex-1 flex-col">
          {!file ? (
            <NoFileSelected projectId={projectId} activity={activity} />
          ) : content === undefined && !activities ? (
            <div className="p-6">
              <EmptyState icon={<FileX2 />} title="Fichier introuvable">
                <span className="font-mono">{file}</span> n'existe pas dans {project.name}.
              </EmptyState>
            </div>
          ) : (
            <>
              <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-1.5">
                <div className="min-w-40 flex-1">
                  <Breadcrumb projectName={project.name} path={file} />
                </div>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={view}
                  onValueChange={(v) => v && go({ view: v as View })}
                  aria-label="Affichage"
                >
                  <ToggleGroupItem
                    value="file"
                    disabled={content === undefined}
                    title={content === undefined ? "Fichier supprimé" : "Contenu du fichier"}
                  >
                    <FileCode2 />
                    Fichier
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="diff"
                    disabled={withDiffs.length === 0}
                    title={withDiffs.length === 0 ? "Aucune modification d'agent sur ce fichier" : "Diffs des sessions"}
                  >
                    <GitCompareArrows />
                    Diff
                  </ToggleGroupItem>
                </ToggleGroup>
                <CopyPathButton path={file} />
                <ExternalEditorDialog location={`${project.path}/${file}${line ? `:${line}` : ""}`} />
              </div>

              {view === "file" && content !== undefined ? (
                <>
                  {markedActivity && (
                    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-4 py-1.5 text-xs text-muted-foreground">
                      <span className="h-3 w-0.5 rounded bg-success/70" />
                      <span className="min-w-0 truncate">
                        Lignes modifiées par « {markedActivity.session.title} » ·{" "}
                        {getHarness(markedActivity.session.harnessId).name} ·{" "}
                        {formatRelative(markedActivity.session.startedAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => go({ view: "diff", sessionId: markedActivity.session.id })}
                        className="shrink-0 text-primary hover:underline"
                      >
                        Voir le diff
                      </button>
                    </div>
                  )}
                  <FileViewer
                    path={file}
                    content={content}
                    line={line}
                    changedLines={changedLines}
                    onSelectLine={(n) => go({ line: n })}
                  />
                </>
              ) : (
                <DiffPane
                  path={file}
                  activities={withDiffs}
                  sessionId={sessionId}
                  line={line}
                  canShowFile={content !== undefined}
                  onSelectSession={(id) => go({ sessionId: id })}
                  onShowFile={() => go({ view: "file" })}
                />
              )}
            </>
          )}
        </section>
      </div>
    </Page>
  );
}

function NoFileSelected({ projectId, activity }: { projectId: string; activity: ProjectActivity }) {
  const recent = activity.sessions.flatMap(({ session, files }) => files.map((f) => ({ session, ...f }))).slice(0, 6);
  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <EmptyState icon={<Code2 />} title="Sélectionnez un fichier">
        Parcourez l'arborescence ou ouvrez un fichier modifié par un agent. Depuis une trace, chaque fichier cité ouvre
        directement le fichier ou le diff concerné.
      </EmptyState>
      {recent.length > 0 && (
        <div className="mx-auto mt-6 max-w-xl space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dernières modifications d'agent
          </h2>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {recent.map(({ session, path, change }) => (
              <Link
                key={`${session.id}:${path}`}
                to={links.code(projectId, { file: path, view: "diff", sessionId: session.id })}
                className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent"
              >
                <ChangeMarker kind={change.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs">{path}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {session.title} · {getHarness(session.harnessId).name} · {formatRelative(change.at)}
                  </span>
                </span>
                <DiffStat additions={change.additions} deletions={change.deletions} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
