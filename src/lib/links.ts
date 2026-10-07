/** Single source of truth for in-app URLs. */
export const links = {
  projects: () => "/projects",
  project: (projectId: string) => `/projects/${projectId}`,
  session: (projectId: string, sessionId: string) => `/projects/${projectId}/sessions/${sessionId}`,
  newSession: (projectId: string, profileId?: string) =>
    `/projects/${projectId}/sessions/new${profileId ? `?profile=${profileId}` : ""}`,
  /** Code workspace; `view=diff` shows the diff produced by `sessionId` for `file`. */
  code: (
    projectId: string,
    opts: { file?: string; line?: number; view?: "file" | "diff"; sessionId?: string } = {},
  ) => {
    const q = new URLSearchParams();
    if (opts.file) q.set("file", opts.file);
    if (opts.line !== undefined) q.set("line", String(opts.line));
    if (opts.view) q.set("view", opts.view);
    if (opts.sessionId) q.set("session", opts.sessionId);
    const qs = q.toString();
    return `/projects/${projectId}/code${qs ? `?${qs}` : ""}`;
  },
  history: () => "/observe",
  observeSession: (sessionId: string, eventId?: string) =>
    `/observe/sessions/${sessionId}${eventId ? `?event=${encodeURIComponent(eventId)}` : ""}`,
  compare: (a: string, b?: string) => `/observe/compare?a=${a}${b ? `&b=${b}` : ""}`,
  lab: () => "/lab",
  newExperiment: () => "/lab/new",
  experiment: (id: string) => `/lab/experiments/${id}`,
  rankings: () => "/lab/rankings",
  features: () => "/lab/features",
  harnesses: () => "/settings/harnesses",
  models: () => "/settings/models",
  profiles: () => "/settings/profiles",
  skills: () => "/settings/skills",
  agents: () => "/settings/agents",
  mcp: () => "/settings/mcp",
} as const;
