import {
  Clock,
  FolderOpen,
  GitBranch,
  LayoutGrid,
  List,
  MessagesSquare,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
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
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HarnessBadge, SessionStatusBadge } from "@/components/warden/badges";
import { EmptyState, Page } from "@/components/warden/page";
import { formatRelative } from "@/lib/format";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import { projects } from "@/mock/fixtures/workspace";
import { getProfile, sessionsForProject } from "@/mock/queries";
import type { Project } from "@/mock/types";

type Layout = "grid" | "list";

/** CDC §8 — work is organised around projects, not agents. */
export function ProjectsScreen() {
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<Layout>("grid");
  const q = query.trim().toLowerCase();
  const visible = [...projects]
    .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))
    .filter((p) => !q || `${p.name} ${p.path} ${p.description} ${p.languages.join(" ")}`.toLowerCase().includes(q));

  return (
    <Page
      title="Projets"
      subtitle={`${projects.length} projets · triés par dernière ouverture`}
      actions={<OpenFolderDialog />}
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par nom, chemin, langage…"
            className="h-8 pl-8"
            aria-label="Filtrer les projets"
          />
        </div>
        <ToggleGroup
          type="single"
          value={layout}
          onValueChange={(v) => v && setLayout(v as Layout)}
          variant="outline"
          size="sm"
          aria-label="Affichage"
        >
          <ToggleGroupItem value="grid" aria-label="Grille">
            <LayoutGrid />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="Liste">
            <List />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={<Search />} title="Aucun projet ne correspond">
          Essayez un autre terme ou effacez le filtre.
        </EmptyState>
      ) : layout === "grid" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visible.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {visible.map((p) => (
            <ProjectRow key={p.id} project={p} />
          ))}
        </div>
      )}
    </Page>
  );
}

function projectSummary(project: Project) {
  const sessions = sessionsForProject(project.id);
  return {
    sessions,
    last: sessions[0],
    profile: project.defaultProfileId ? getProfile(project.defaultProfileId) : undefined,
  };
}

function ProjectCard({ project }: { project: Project }) {
  const { sessions, last, profile } = projectSummary(project);
  return (
    <Link
      to={links.project(project.id)}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:border-primary focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold group-hover:text-primary">{project.name}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">{project.path}</div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          {formatRelative(project.lastOpenedAt)}
        </span>
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex h-5 items-center gap-1 rounded border border-border px-1.5 font-mono text-[11px]">
          <GitBranch className="size-3" />
          {project.branch}
        </span>
        {project.languages.map((l) => (
          <span key={l} className="inline-flex h-5 items-center rounded bg-secondary px-1.5 text-[11px]">
            {l}
          </span>
        ))}
      </div>
      <div className="mt-auto space-y-2 border-t border-border pt-3 text-xs">
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MessagesSquare className="size-3.5" />
            {sessions.length} session{sessions.length > 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1">
            <SlidersHorizontal className="size-3.5" />
            Profil par défaut : <span className="text-foreground">{profile?.name ?? "aucun"}</span>
          </span>
        </div>
        {last ? (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-muted-foreground">Dernière :</span>
            <span className="min-w-0 flex-1 truncate">{last.title}</span>
            <HarnessBadge harnessId={last.harnessId} className="h-5" />
            <SessionStatusBadge status={last.status} />
          </div>
        ) : (
          <div className="text-muted-foreground">Aucune session pour l'instant</div>
        )}
      </div>
    </Link>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const { sessions, last, profile } = projectSummary(project);
  return (
    <Link
      to={links.project(project.id)}
      className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_minmax(0,1.4fr)_auto] items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-accent/40"
    >
      <div className="min-w-0">
        <div className="truncate font-medium">{project.name}</div>
        <div className="truncate font-mono text-xs text-muted-foreground">{project.path}</div>
      </div>
      <div className="min-w-0 text-xs">
        <div className="inline-flex items-center gap-1 font-mono">
          <GitBranch className="size-3" />
          <span className="truncate">{project.branch}</span>
        </div>
        <div className="truncate text-muted-foreground">{project.languages.join(" · ")}</div>
      </div>
      <div className="text-right text-xs text-muted-foreground tabular-nums">
        <div>{sessions.length} sessions</div>
        <div>{profile?.name ?? "—"}</div>
      </div>
      <div className={cn("flex min-w-0 items-center gap-2 text-xs", !last && "text-muted-foreground")}>
        {last ? (
          <>
            <SessionStatusBadge status={last.status} />
            <span className="truncate">{last.title}</span>
          </>
        ) : (
          "Aucune session"
        )}
      </div>
      <div className="text-xs text-muted-foreground">{formatRelative(project.lastOpenedAt)}</div>
    </Link>
  );
}

function OpenFolderDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FolderOpen /> Ouvrir un dossier…
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ouvrir un dossier</DialogTitle>
          <DialogDescription>
            Dans Warden, ouvrir un dossier l'ajoute à vos projets : ses sessions, préférences, profils et benchmarks y
            seront rattachés.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Cette maquette n'a pas accès au système de fichiers : utilisez l'un des trois projets de démonstration.
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Compris</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
