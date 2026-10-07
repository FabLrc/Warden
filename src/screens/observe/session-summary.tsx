import { ArrowUpRight } from "lucide-react";
import { Markdown } from "@/components/warden/markdown";
import { ConfidenceBadge, ObservedValue } from "@/components/warden/observation";
import { Section } from "@/components/warden/page";
import { formatCost, formatDuration, formatTokens } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Observation, Session, TraceEvent } from "@/mock/types";
import { formatOffset, METRIC_DEFS, offsetMs, sumKnown, timeBreakdown, tokenBreakdown } from "./analysis";
import { CompactObserved, TimeBreakdownBars } from "./observe-ui";
import { SessionLists } from "./session-lists";

interface SummaryProps {
  session: Session;
  trace: TraceEvent[];
  onSelectEvent: (eventId: string) => void;
}

/** P4 — what happened, how much it cost, where the time and tokens went. */
export function SessionSummary({ session, trace, onSelectEvent }: SummaryProps) {
  const prompt = trace.find((e) => e.kind === "user-prompt");
  const answer = [...trace].reverse().find((e) => e.kind === "assistant-message");
  return (
    <div className="space-y-8">
      <Section title="Ce qui s'est passé">
        <div className="grid gap-3 lg:grid-cols-2">
          <TextCard title="Demande" event={prompt} onSelectEvent={onSelectEvent} empty="Aucun prompt dans la trace." />
          <TextCard
            title="Dernière réponse de l'agent"
            event={answer}
            onSelectEvent={onSelectEvent}
            empty="L'agent n'a pas produit de réponse finale."
          />
        </div>
      </Section>

      <Section title="Métriques de session">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          {METRIC_DEFS.map((m) => (
            <div key={m.key} className="rounded-lg border border-border bg-card px-3 py-2.5">
              <div className="text-xs text-muted-foreground">{m.label}</div>
              <ObservedValue obs={session.metrics[m.key]} format={m.format} className="mt-1 text-base font-medium" />
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-8 xl:grid-cols-2">
        <Section title="Où est passé le temps">
          <div className="rounded-lg border border-border bg-card p-4">
            <TimeBreakdownBars breakdown={timeBreakdown(session, trace)} />
            <p className="mt-3 text-[11px] text-muted-foreground">
              Calculé à partir des durées des événements de la trace. Les appels modèle synthétisés par Warden (pas
              d'événement natif côté harness) sont marqués Inferred.
            </p>
          </div>
        </Section>
        <Section title="Où sont passés les tokens">
          <TokensBlock session={session} trace={trace} onSelectEvent={onSelectEvent} />
        </Section>
      </div>

      <SessionLists session={session} trace={trace} onSelectEvent={onSelectEvent} />
    </div>
  );
}

function TextCard({
  title,
  event,
  empty,
  onSelectEvent,
}: {
  title: string;
  event?: TraceEvent;
  empty: string;
  onSelectEvent: (eventId: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
        <span>{title}</span>
        {event && (
          <button
            type="button"
            onClick={() => onSelectEvent(event.id)}
            className="inline-flex items-center gap-1 hover:text-primary"
          >
            Voir dans la trace
            <ArrowUpRight className="size-3" />
          </button>
        )}
      </div>
      <div className="max-h-56 overflow-auto px-3 py-2 text-sm">
        {event?.text ? <Markdown>{event.text}</Markdown> : <span className="text-muted-foreground">{empty}</span>}
      </div>
    </div>
  );
}

// ── Tokens ─────────────────────────────────────────────────────────────────

function TokensBlock({ session, trace, onSelectEvent }: SummaryProps) {
  const { metrics } = session;
  const totals: { label: string; obs: Observation<number> }[] = [
    { label: "Entrée", obs: metrics.inputTokens },
    { label: "Sortie", obs: metrics.outputTokens },
    { label: "Lus en cache", obs: metrics.cacheReadTokens },
    { label: "dont prompt système", obs: metrics.systemPromptTokens },
  ];
  const maxTotal = Math.max(1, ...totals.map((t) => t.obs.value ?? 0));
  const { calls, perCallAvailable, unavailableReason } = tokenBreakdown(session, trace);
  const tracedInput = sumKnown(calls.map((c) => c.input));
  const maxCallInput = Math.max(1, ...calls.map((c) => c.input.value ?? 0));
  const reportedCalls = metrics.modelCalls.value;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="space-y-2.5">
        {totals.map((t) => (
          <div key={t.label} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-xs">
            <span className="text-muted-foreground">{t.label}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
              {t.obs.value !== null && (
                <div
                  className={cn(
                    "h-full rounded-full bg-primary/80",
                    t.obs.confidence !== "observed" && "bg-primary/40",
                  )}
                  style={{ width: `${(t.obs.value / maxTotal) * 100}%` }}
                />
              )}
            </div>
            <ObservedValue obs={t.obs} format={formatTokens} className="justify-end" />
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium">Par appel modèle</span>
          {!perCallAvailable && <ConfidenceBadge confidence="unavailable" />}
        </div>
        {perCallAvailable ? (
          <>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="[&>th]:pb-1.5 [&>th]:font-normal">
                  <th className="text-left">Appel</th>
                  <th className="text-right">Entrée</th>
                  <th className="text-right">Sortie</th>
                  <th className="text-right">Coût</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.event.id} className="hover:bg-accent/50 [&>td]:py-1">
                    <td className="truncate">
                      <button
                        type="button"
                        onClick={() => onSelectEvent(c.event.id)}
                        className="text-left hover:text-primary"
                        title="Voir dans la trace"
                      >
                        {c.event.title}
                        <span className="ml-1.5 text-muted-foreground tabular-nums">
                          {formatOffset(offsetMs(session, c.event))}
                        </span>
                      </button>
                    </td>
                    <td className="text-right">
                      <CompactObserved obs={c.input} format={formatTokens} />
                    </td>
                    <td className="text-right">
                      <CompactObserved obs={c.output} format={formatTokens} />
                    </td>
                    <td className="text-right">
                      {c.cost ? (
                        <CompactObserved obs={c.cost} format={formatCost} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="pl-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                        {c.input.value !== null && (
                          <div
                            className="h-full rounded-full bg-chart-4"
                            style={{ width: `${(c.input.value / maxCallInput) * 100}%` }}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reportedCalls !== null && reportedCalls > calls.length && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                La trace conservée détaille {calls.length} appels sur {reportedCalls} rapportés par le harness.
                {tracedInput !== null && metrics.inputTokens.value !== null && (
                  <>
                    {" "}
                    {formatTokens(Math.max(0, metrics.inputTokens.value - tracedInput))} tokens d'entrée ne sont
                    attribués à aucun appel tracé.
                  </>
                )}
              </p>
            )}
          </>
        ) : (
          <div className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              {unavailableReason} Warden n'estime pas cette répartition : seuls les totaux de session ci-dessus sont
              connus.
            </p>
            {calls.length > 0 && (
              <ul className="divide-y divide-border/60 rounded-md border border-border/60">
                {calls.map((c) => (
                  <li key={c.event.id}>
                    <button
                      type="button"
                      onClick={() => onSelectEvent(c.event.id)}
                      className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left hover:bg-accent/50"
                    >
                      <span className="truncate">{c.event.title}</span>
                      <span className="flex shrink-0 items-center gap-3 text-muted-foreground tabular-nums">
                        {c.event.durationMs !== undefined && formatDuration(c.event.durationMs)}
                        <span title="Tokens par appel : Unavailable">— tokens</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
