import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { useParams } from "react-router";
import { projects } from "@/mock/fixtures/workspace";

interface ProjectState {
  projectId: string;
  setProjectId: (id: string) => void;
}

const ProjectContext = createContext<ProjectState | null>(null);

/** Remembers the last opened project so the Work sidebar keeps context on other sections. */
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectId] = useState(projects[0].id);
  return <ProjectContext.Provider value={{ projectId, setProjectId }}>{children}</ProjectContext.Provider>;
}

export function useCurrentProject(): ProjectState {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useCurrentProject outside ProjectProvider");
  return ctx;
}

/** Syncs the remembered project with the `:projectId` route param. */
export function useSyncProjectFromRoute() {
  const { projectId } = useParams();
  const { setProjectId } = useCurrentProject();
  useEffect(() => {
    if (projectId && projects.some((p) => p.id === projectId)) setProjectId(projectId);
  }, [projectId, setProjectId]);
}
