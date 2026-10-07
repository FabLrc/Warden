import { Info, MousePointerClick } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DiffView } from "@/components/warden/diff-view";
import { Markdown } from "@/components/warden/markdown";
import { ObservedValue } from "@/components/warden/observation";
import { EmptyState, KeyValue } from "@/components/warden/page";
import { TRACE_KIND_META, TraceKindIcon } from "@/components/warden/trace-meta";
import { formatCost, formatDuration, formatTime, formatTokens } from "@/lib/format";
import { PERMISSION_DECISION_LABELS, PERMISSION_KIND_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { getHarness } from "@/mock/queries";
import type { Session, TraceEvent } from "@/mock/types";
import { formatOffset, isSynthesized, offsetMs } from "./analysis";
import { FileLink, TraceStatusBadge } from "./observe-ui";

type InspectorView = "normalized" | "raw";

/** Selected trace event: normalised fields, or the raw harness payload (CDC §18). */
export function EventInspector({
  session,
  trace,
  event,
  onSelect,
}: {
  session: Session;
  trace: TraceEvent[];
  event?: TraceEvent;
  onSelect: (eventId: string) => void;
}) {
  const [view, setView] = useState<InspectorView>("normalized");
  if (!event) {
    return (
      <EmptyState icon={<MousePointerClick />} title="Aucun événement sélectionné">
        Cliquez sur un événement de la trace (ou sur une ligne du résumé) pour voir ses champs normalisés et l'événement
        brut reçu de {getHarness(session.harnessId).name}.
      </EmptyState>
    );
  }
  const parent = event.parentId ? trace.find((e) => e.id === event.parentId) : undefined;
  const children = trace.filter((e) => e.parentId === event.id);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <TraceKindIcon kind={event.kind} />
          {TRACE_KIND_META[event.kind].label}
          {event.status && <TraceStatusBadge status={event.status} />}
        </div>
        <div className="text-sm font-medium break-words">{event.title}</div>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        value={view}
        onValueChange={(value) => value && setView(value as InspectorView)}
        className="w-full"
      >
        <ToggleGroupItem value="normalized" className="flex-1">
          Normalisé
        </ToggleGroupItem>
        <ToggleGroupItem value="raw" className="flex-1">
          Brut
        </ToggleGroupItem>
      </ToggleGroup>

      {view === "raw" ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            {isSynthesized(event)
              ? "Aucun message natif : événement synthétisé par Warden à partir du flux ACP."
              : `Événement tel que reçu de ${getHarness(session.harnessId).name}, conservé sans transformation.`}
          </p>
          <pre className="overflow-auto rounded-md border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed">
            {JSON.stringify(event.raw, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="divide-y divide-border/60">
            <KeyValue label="Heure">
              <span className="font-mono text-xs tabular-nums">
                {formatTime(event.at)}{" "}
                <span className="text-muted-foreground">{formatOffset(offsetMs(session, event))}</span>
              </span>
            </KeyValue>
            {event.durationMs !== undefined && (
              <KeyValue label="Durée">
                <span className="tabular-nums">{formatDuration(event.durationMs)}</span>
              </KeyValue>
            )}
            {event.tool && (
              <KeyValue label="Outil">
                <span className="font-mono text-xs">{event.tool}</span>
              </KeyValue>
            )}
            {event.file && (
              <KeyValue label="Fichier">
                <FileLink
                  projectId={session.projectId}
                  sessionId={session.id}
                  file={event.file}
                  view={event.kind === "file-edit" ? "diff" : "file"}
                  className="max-w-48"
                />
              </KeyValue>
            )}
            {parent && (
              <KeyValue label="Parent">
                <button
                  type="button"
                  onClick={() => onSelect(parent.id)}
                  className="truncate text-left text-xs hover:text-primary hover:underline"
                >
                  {parent.title}
                </button>
              </KeyValue>
            )}
          </div>

          {event.tokens && (
            <Block title="Usage">
              <div className="divide-y divide-border/60">
                <KeyValue label="Tokens d'entrée">
                  <ObservedValue obs={event.tokens.input} format={formatTokens} />
                </KeyValue>
                <KeyValue label="Tokens de sortie">
                  <ObservedValue obs={event.tokens.output} format={formatTokens} />
                </KeyValue>
                {event.cost && (
                  <KeyValue label="Coût">
                    <ObservedValue obs={event.cost} format={formatCost} />
                  </KeyValue>
                )}
              </div>
              {event.tokens.input.value === null && (
                <p className="mt-2 flex gap-1.5 text-[11px] text-muted-foreground">
                  <Info className="mt-px size-3 shrink-0" />
                  {event.tokens.input.note ?? "Le harness ne rapporte pas l'usage de cet appel."} Seuls les totaux de
                  session sont connus.
                </p>
              )}
            </Block>
          )}

          {event.permission && (
            <Block title="Permission">
              <div className="divide-y divide-border/60">
                <KeyValue label="Type">{PERMISSION_KIND_LABELS[event.permission.kind]}</KeyValue>
                <KeyValue label="Décision">
                  <span
                    className={cn(
                      event.permission.decision === "deny"
                        ? "text-destructive"
                        : event.permission.decision
                          ? "text-success"
                          : "text-warning",
                    )}
                  >
                    {event.permission.decision ? PERMISSION_DECISION_LABELS[event.permission.decision] : "En attente"}
                  </span>
                </KeyValue>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{event.permission.reason}</p>
            </Block>
          )}

          {event.text && (
            <Block title={event.kind === "user-prompt" ? "Prompt" : "Contenu"}>
              <div className="text-sm">
                <Markdown>{event.text}</Markdown>
              </div>
            </Block>
          )}

          {(event.command || event.output) && (
            <Block title={event.command ? "Commande" : "Sortie"}>
              <pre className="overflow-auto rounded-md border border-border bg-surface p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre">
                {event.command && <span className="text-primary">$ {event.command}</span>}
                {event.command && event.output && "\n"}
                {event.output}
              </pre>
              {event.exitCode !== undefined && (
                <div
                  className={cn(
                    "mt-1.5 font-mono text-[11px]",
                    event.exitCode === 0 ? "text-success" : "text-destructive",
                  )}
                >
                  exit code {event.exitCode}
                </div>
              )}
            </Block>
          )}

          {event.diff && (
            <Block title="Diff">
              <DiffView diff={event.diff} highlightLine={event.file?.line} />
            </Block>
          )}

          {children.length > 0 && (
            <Block title={`Événements enfants (${children.length})`}>
              <ul className="space-y-0.5">
                {children.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-accent/60"
                    >
                      <TraceKindIcon kind={c.kind} className="size-3.5" />
                      <span className="truncate">{c.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Block>
          )}
        </div>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{title}</div>
      {children}
    </div>
  );
}
