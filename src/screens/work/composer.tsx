import { ArrowUp, Square } from "lucide-react";
import { type ReactNode, type Ref, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Prompt composer. Enter sends, Shift+Enter inserts a newline.
 * While the agent works, the send button becomes "Interrompre" (Esc is handled by the screen).
 */
export function Composer({
  onSend,
  onInterrupt,
  active,
  disabled,
  notice,
  toolbar,
  placeholder,
  sendLabel = "Envoyer",
  textareaRef,
}: {
  onSend: (prompt: string) => void;
  onInterrupt: () => void;
  /** The agent is working (streaming or waiting for a permission answer). */
  active: boolean;
  /** Sending is blocked; `notice` should explain why. */
  disabled: boolean;
  /** Shown above the input (warnings, blocking reasons). */
  notice?: ReactNode;
  /** Left side of the bottom bar (config picker or session summary). */
  toolbar?: ReactNode;
  placeholder: string;
  sendLabel?: string;
  textareaRef?: Ref<HTMLTextAreaElement>;
}) {
  const [text, setText] = useState("");
  const canSend = !disabled && !active && text.trim().length > 0;
  const send = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <div className="shrink-0 border-t border-border bg-surface px-6 py-3">
      <div className="mx-auto w-full max-w-3xl space-y-2">
        {notice}
        <div
          className={cn(
            "rounded-lg border border-border bg-card transition-colors focus-within:border-primary/60",
            disabled && "opacity-70",
          )}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            disabled={disabled}
            placeholder={placeholder}
            rows={2}
            className="block max-h-48 min-h-14 w-full resize-none bg-transparent px-3 pt-2.5 text-sm outline-none field-sizing-content placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
          <div className="flex items-end gap-2 px-2 pb-2">
            <div className="min-w-0 flex-1">{toolbar}</div>
            {active ? (
              <Button size="sm" variant="destructive" onClick={onInterrupt} title="Interrompre (Échap)">
                <Square className="fill-current" /> Interrompre
                <kbd className="ml-1 rounded border border-destructive/40 px-1 font-mono text-[10px]">Esc</kbd>
              </Button>
            ) : (
              <Button size="sm" onClick={send} disabled={!canSend}>
                {sendLabel} <ArrowUp />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
