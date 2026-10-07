import {
  AlertOctagon,
  Bot,
  Brain,
  CirclePlay,
  CircleStop,
  Cpu,
  FileEdit,
  FileText,
  type LucideIcon,
  OctagonX,
  ShieldQuestion,
  SquareTerminal,
  User,
  Wrench,
} from "lucide-react";
import type { TraceEventKind } from "@/mock/types";

/** Shared icon / label / color per trace event kind (conversation, timeline, trace list). */
export const TRACE_KIND_META: Record<TraceEventKind, { label: string; icon: LucideIcon; color: string }> = {
  "session-start": { label: "Début de session", icon: CirclePlay, color: "text-muted-foreground" },
  "user-prompt": { label: "Prompt", icon: User, color: "text-bone" },
  "model-call": { label: "Appel modèle", icon: Cpu, color: "text-chart-4" },
  thinking: { label: "Réflexion", icon: Brain, color: "text-muted-foreground" },
  "assistant-message": { label: "Message agent", icon: Bot, color: "text-primary" },
  "tool-call": { label: "Outil", icon: Wrench, color: "text-info" },
  "permission-request": { label: "Permission", icon: ShieldQuestion, color: "text-warning" },
  "file-read": { label: "Lecture", icon: FileText, color: "text-info" },
  "file-edit": { label: "Édition", icon: FileEdit, color: "text-success" },
  command: { label: "Commande", icon: SquareTerminal, color: "text-chart-3" },
  error: { label: "Erreur", icon: AlertOctagon, color: "text-destructive" },
  interrupt: { label: "Interruption", icon: OctagonX, color: "text-destructive" },
  "session-end": { label: "Fin de session", icon: CircleStop, color: "text-muted-foreground" },
};

export function TraceKindIcon({ kind, className }: { kind: TraceEventKind; className?: string }) {
  const { icon: Icon, color } = TRACE_KIND_META[kind];
  return <Icon className={`size-4 shrink-0 ${color} ${className ?? ""}`} aria-label={TRACE_KIND_META[kind].label} />;
}
