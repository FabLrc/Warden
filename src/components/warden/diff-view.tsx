import { cn } from "@/lib/utils";

interface DiffLine {
  kind: "add" | "del" | "ctx" | "hunk" | "meta";
  text: string;
  oldNo?: number;
  newNo?: number;
}

function parseUnifiedDiff(diff: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  for (const text of diff.split("\n")) {
    if (text.startsWith("---") || text.startsWith("+++")) {
      lines.push({ kind: "meta", text });
    } else if (text.startsWith("@@")) {
      const m = /@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(text);
      oldNo = m ? Number(m[1]) : 0;
      newNo = m ? Number(m[2]) : 0;
      lines.push({ kind: "hunk", text });
    } else if (text.startsWith("+")) {
      lines.push({ kind: "add", text: text.slice(1), newNo: newNo++ });
    } else if (text.startsWith("-")) {
      lines.push({ kind: "del", text: text.slice(1), oldNo: oldNo++ });
    } else {
      lines.push({ kind: "ctx", text: text.slice(1), oldNo: oldNo++, newNo: newNo++ });
    }
  }
  return lines;
}

const ROW: Record<DiffLine["kind"], string> = {
  add: "bg-success/10 text-foreground",
  del: "bg-destructive/10 text-foreground/80",
  ctx: "text-muted-foreground",
  hunk: "bg-primary/5 text-primary/80",
  meta: "text-muted-foreground/70",
};

const SIGN: Record<DiffLine["kind"], string> = { add: "+", del: "−", ctx: " ", hunk: "", meta: "" };

/** Read-only unified diff, with line numbers. `highlightLine` refers to the new file. */
export function DiffView({
  diff,
  highlightLine,
  hideMeta = true,
  className,
}: {
  diff: string;
  highlightLine?: number;
  hideMeta?: boolean;
  className?: string;
}) {
  const lines = parseUnifiedDiff(diff).filter((l) => !(hideMeta && l.kind === "meta"));
  return (
    <div className={cn("overflow-auto rounded-md border border-border bg-surface font-mono text-xs", className)}>
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((l, i) => (
            <tr
              key={i}
              data-new-line={l.newNo}
              data-highlighted={highlightLine !== undefined && l.newNo === highlightLine ? "" : undefined}
              className={cn(
                ROW[l.kind],
                "data-highlighted:outline data-highlighted:-outline-offset-1 data-highlighted:outline-primary",
              )}
            >
              <td className="w-10 select-none border-r border-border/60 px-2 text-right text-muted-foreground/60">
                {l.oldNo ?? ""}
              </td>
              <td className="w-10 select-none border-r border-border/60 px-2 text-right text-muted-foreground/60">
                {l.newNo ?? ""}
              </td>
              <td
                className={cn(
                  "w-5 select-none text-center",
                  l.kind === "add" && "text-success",
                  l.kind === "del" && "text-destructive",
                )}
              >
                {SIGN[l.kind]}
              </td>
              <td className="whitespace-pre px-2 py-px">{l.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "+14 −6" summary. */
export function DiffStat({ additions, deletions }: { additions: number; deletions: number }) {
  return (
    <span className="font-mono text-[11px] tabular-nums">
      <span className="text-success">+{additions}</span> <span className="text-destructive">−{deletions}</span>
    </span>
  );
}
