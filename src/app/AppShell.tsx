import {
  Activity,
  Blocks,
  Bot,
  Code2,
  Cpu,
  FlaskConical,
  FolderKanban,
  GitCompareArrows,
  History,
  Home,
  Layers,
  type LucideIcon,
  Plug,
  Plus,
  Settings2,
  SlidersHorizontal,
  ToggleRight,
  Trophy,
} from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useCurrentProject } from "@/app/project-context";
import { WardenLogo } from "@/app/WardenLogo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SessionStatusDot } from "@/components/warden/badges";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import { experiments } from "@/mock/fixtures/lab";
import { projects } from "@/mock/fixtures/workspace";
import { allSessionsNewestFirst, sessionsForProject } from "@/mock/queries";

type SectionId = "work" | "observe" | "lab" | "settings";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; to: string; match: (path: string) => boolean }[] = [
  { id: "work", label: "Work", icon: FolderKanban, to: links.projects(), match: (p) => p.startsWith("/projects") },
  { id: "observe", label: "Observe", icon: Activity, to: links.history(), match: (p) => p.startsWith("/observe") },
  { id: "lab", label: "Lab", icon: FlaskConical, to: links.lab(), match: (p) => p.startsWith("/lab") },
  {
    id: "settings",
    label: "Configuration",
    icon: Settings2,
    to: links.harnesses(),
    match: (p) => p.startsWith("/settings"),
  },
];

export function AppShell() {
  const { pathname } = useLocation();
  const section = SECTIONS.find((s) => s.match(pathname))?.id ?? "work";
  return (
    <div className="flex h-full">
      <Rail section={section} />
      <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        {section === "work" && <WorkSidebar />}
        {section === "observe" && <ObserveSidebar />}
        {section === "lab" && <LabSidebar />}
        {section === "settings" && <SettingsSidebar />}
      </aside>
      <main className="flex min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function Rail({ section }: { section: SectionId }) {
  return (
    <nav
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-background py-3"
      aria-label="Sections"
    >
      <WardenLogo className="mb-3 size-8" />
      {SECTIONS.map((s) => (
        <Tooltip key={s.id}>
          <TooltipTrigger asChild>
            <NavLink
              to={s.to}
              aria-label={s.label}
              className={cn(
                "relative flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                section === s.id && "bg-sidebar-accent text-primary glow-soul",
              )}
            >
              <s.icon className="size-5" />
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right">{s.label}</TooltipContent>
        </Tooltip>
      ))}
    </nav>
  );
}

function SidebarHeader({ children }: { children: ReactNode }) {
  return <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">{children}</div>;
}

function SidebarGroup({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-2 py-2">
      {title && (
        <div className="flex items-center justify-between px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
          {action}
        </div>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  children,
  end,
}: {
  to: string;
  icon?: LucideIcon;
  children: ReactNode;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex h-8 items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        )
      }
    >
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </NavLink>
  );
}

function WorkSidebar() {
  const { projectId } = useCurrentProject();
  const navigate = useNavigate();
  const projectSessions = sessionsForProject(projectId);
  return (
    <>
      <SidebarHeader>
        <Select value={projectId} onValueChange={(id) => navigate(links.project(id))}>
          <SelectTrigger className="w-full" aria-label="Projet courant">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SidebarHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <SidebarGroup>
          <SidebarLink to={links.project(projectId)} icon={Home} end>
            Accueil du projet
          </SidebarLink>
          <SidebarLink to={links.newSession(projectId)} icon={Plus}>
            Nouvelle session
          </SidebarLink>
          <SidebarLink to={links.code(projectId)} icon={Code2}>
            Code
          </SidebarLink>
        </SidebarGroup>
        <SidebarGroup title="Sessions">
          {projectSessions.map((s) => (
            <NavLink
              key={s.id}
              to={links.session(projectId, s.id)}
              className={({ isActive }) =>
                cn(
                  "flex h-8 items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                )
              }
              title={s.title}
            >
              <SessionStatusDot status={s.status} />
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
            </NavLink>
          ))}
        </SidebarGroup>
      </div>
      <div className="border-t border-sidebar-border p-2">
        <SidebarLink to={links.projects()} icon={FolderKanban} end>
          Tous les projets
        </SidebarLink>
      </div>
    </>
  );
}

function ObserveSidebar() {
  return (
    <>
      <SidebarHeader>
        <span className="text-sm font-semibold">Observe</span>
      </SidebarHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <SidebarGroup>
          <SidebarLink to={links.history()} icon={History} end>
            Historique
          </SidebarLink>
          <SidebarLink to="/observe/compare" icon={GitCompareArrows}>
            Comparer deux sessions
          </SidebarLink>
        </SidebarGroup>
        <SidebarGroup title="Récentes">
          {allSessionsNewestFirst()
            .slice(0, 8)
            .map((s) => (
              <SidebarLink key={s.id} to={links.observeSession(s.id)}>
                <span className="flex items-center gap-2">
                  <SessionStatusDot status={s.status} />
                  <span className="truncate">{s.title}</span>
                </span>
              </SidebarLink>
            ))}
        </SidebarGroup>
      </div>
    </>
  );
}

function LabSidebar() {
  return (
    <>
      <SidebarHeader>
        <span className="text-sm font-semibold">Lab</span>
      </SidebarHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <SidebarGroup>
          <SidebarLink to={links.lab()} icon={FlaskConical} end>
            Expériences
          </SidebarLink>
          <SidebarLink to={links.newExperiment()} icon={Plus}>
            Nouvelle expérience
          </SidebarLink>
          <SidebarLink to={links.rankings()} icon={Trophy}>
            Rankings
          </SidebarLink>
          <SidebarLink to={links.features()} icon={ToggleRight}>
            Fonctionnalités ON / OFF
          </SidebarLink>
        </SidebarGroup>
        <SidebarGroup title="Expériences">
          {experiments.map((e) => (
            <SidebarLink key={e.id} to={links.experiment(e.id)}>
              {e.name}
            </SidebarLink>
          ))}
        </SidebarGroup>
      </div>
    </>
  );
}

function SettingsSidebar() {
  return (
    <>
      <SidebarHeader>
        <span className="text-sm font-semibold">Configuration</span>
      </SidebarHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <SidebarGroup title="Moteurs">
          <SidebarLink to={links.harnesses()} icon={Blocks}>
            Harnesses
          </SidebarLink>
          <SidebarLink to={links.models()} icon={Cpu}>
            Providers et modèles
          </SidebarLink>
        </SidebarGroup>
        <SidebarGroup title="Workflow">
          <SidebarLink to={links.profiles()} icon={SlidersHorizontal}>
            Profils
          </SidebarLink>
          <SidebarLink to={links.skills()} icon={Layers}>
            Skills
          </SidebarLink>
          <SidebarLink to={links.agents()} icon={Bot}>
            Agents
          </SidebarLink>
          <SidebarLink to={links.mcp()} icon={Plug}>
            MCP et outils
          </SidebarLink>
        </SidebarGroup>
      </div>
    </>
  );
}
