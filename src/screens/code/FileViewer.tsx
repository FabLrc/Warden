import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { languageOf, useHighlightedLines } from "./highlight";

/**
 * Read-only file with line numbers, shiki highlighting (plain text until the highlighter is ready),
 * a gutter mark on `changedLines` and `line` highlighted and scrolled into view.
 */
export function FileViewer({
  path,
  content,
  line,
  changedLines,
  onSelectLine,
}: {
  path: string;
  content: string;
  line?: number;
  changedLines: Set<number>;
  onSelectLine: (line: number) => void;
}) {
  const { lang } = languageOf(path);
  const code = content.replace(/\n$/, "");
  const lines = useMemo(() => code.split("\n"), [code]);
  const tokens = useHighlightedLines(code, lang);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrap = lang === "markdown";

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll when another file is opened, even at the same line.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const row = line === undefined ? null : container.querySelector(`[data-line="${line}"]`);
    if (row) row.scrollIntoView({ block: "center" });
    else container.scrollTo({ top: 0 });
  }, [path, line]);

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-auto bg-background font-mono text-xs leading-5">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((text, i) => {
            const n = i + 1;
            const selected = n === line;
            return (
              <tr key={n} data-line={n} className={cn(selected ? "bg-primary/10" : "hover:bg-accent/40")}>
                <td
                  className={cn(
                    "w-px border-l-2 align-top",
                    changedLines.has(n) ? "border-success/70" : "border-transparent",
                    selected && "border-primary",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectLine(n)}
                    className={cn(
                      "block w-full min-w-10 select-none px-3 text-right tabular-nums",
                      selected ? "text-primary" : "text-muted-foreground/50 hover:text-foreground",
                    )}
                    aria-label={`Ligne ${n}`}
                  >
                    {n}
                  </button>
                </td>
                <td className={cn("pr-6", wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre")}>
                  {tokens?.[i]
                    ? tokens[i].map((t, j) => {
                        // shiki FontStyle bit flags (Italic = 1, Bold = 2); NotSet is -1.
                        const fontStyle = Math.max(t.fontStyle ?? 0, 0);
                        return (
                          <span
                            key={j}
                            style={{ color: t.color }}
                            className={cn(fontStyle & 1 && "italic", fontStyle & 2 && "font-semibold")}
                          >
                            {t.content}
                          </span>
                        );
                      })
                    : text || " "}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
