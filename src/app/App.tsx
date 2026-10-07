import { createHashRouter, Navigate, Outlet, RouterProvider } from "react-router";
import { AppShell } from "@/app/AppShell";
import { ProjectProvider, useSyncProjectFromRoute } from "@/app/project-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InspectorProvider } from "@/components/warden/page";
import { CodeScreen } from "@/screens/code/CodeScreen";
import { ExperimentScreen } from "@/screens/lab/ExperimentScreen";
import { ExperimentsScreen } from "@/screens/lab/ExperimentsScreen";
import { FeaturesScreen } from "@/screens/lab/FeaturesScreen";
import { NewExperimentScreen } from "@/screens/lab/NewExperimentScreen";
import { RankingsScreen } from "@/screens/lab/RankingsScreen";
import { CompareScreen } from "@/screens/observe/CompareScreen";
import { HistoryScreen } from "@/screens/observe/HistoryScreen";
import { SessionObserveScreen } from "@/screens/observe/SessionObserveScreen";
import { AgentsScreen } from "@/screens/settings/AgentsScreen";
import { HarnessesScreen } from "@/screens/settings/HarnessesScreen";
import { McpScreen } from "@/screens/settings/McpScreen";
import { ModelsScreen } from "@/screens/settings/ModelsScreen";
import { ProfilesScreen } from "@/screens/settings/ProfilesScreen";
import { SkillsScreen } from "@/screens/settings/SkillsScreen";
import { ProjectHomeScreen } from "@/screens/work/ProjectHomeScreen";
import { ProjectsScreen } from "@/screens/work/ProjectsScreen";
import { SessionScreen } from "@/screens/work/SessionScreen";

/** Keeps the "current project" in sync with any `/projects/:projectId/*` route. */
function ProjectScope() {
  useSyncProjectFromRoute();
  return <Outlet />;
}

// Hash router: deep links survive reloads in the packaged Tauri app without server rewrites.
const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/projects" replace /> },
      { path: "projects", element: <ProjectsScreen /> },
      {
        path: "projects/:projectId",
        element: <ProjectScope />,
        children: [
          { index: true, element: <ProjectHomeScreen /> },
          { path: "sessions/new", element: <SessionScreen /> },
          { path: "sessions/:sessionId", element: <SessionScreen /> },
          { path: "code", element: <CodeScreen /> },
        ],
      },
      { path: "observe", element: <HistoryScreen /> },
      { path: "observe/sessions/:sessionId", element: <SessionObserveScreen /> },
      { path: "observe/compare", element: <CompareScreen /> },
      { path: "lab", element: <ExperimentsScreen /> },
      { path: "lab/new", element: <NewExperimentScreen /> },
      { path: "lab/experiments/:experimentId", element: <ExperimentScreen /> },
      { path: "lab/rankings", element: <RankingsScreen /> },
      { path: "lab/features", element: <FeaturesScreen /> },
      { path: "settings", element: <Navigate to="/settings/harnesses" replace /> },
      { path: "settings/harnesses", element: <HarnessesScreen /> },
      { path: "settings/models", element: <ModelsScreen /> },
      { path: "settings/profiles", element: <ProfilesScreen /> },
      { path: "settings/skills", element: <SkillsScreen /> },
      { path: "settings/agents", element: <AgentsScreen /> },
      { path: "settings/mcp", element: <McpScreen /> },
      { path: "*", element: <Navigate to="/projects" replace /> },
    ],
  },
]);

export function App() {
  return (
    <TooltipProvider delayDuration={250}>
      <ProjectProvider>
        <InspectorProvider>
          <RouterProvider router={router} />
        </InspectorProvider>
      </ProjectProvider>
    </TooltipProvider>
  );
}
