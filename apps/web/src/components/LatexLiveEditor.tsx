"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LatexEdit } from "@/lib/resumeChecker/types";

type Props = {
  baseLatex: string;
  finalLatex: string;
  edits: LatexEdit[];
  active: boolean;
  onAnimationDone?: () => void;
};

type LineMark = "active" | "added" | "changed" | "normal";

export function LatexLiveEditor({ baseLatex, finalLatex, edits, active, onAnimationDone }: Props) {
  const [visibleLatex, setVisibleLatex] = useState(baseLatex || finalLatex);
  const [activeEditIndex, setActiveEditIndex] = useState(-1);
  const [status, setStatus] = useState("Ready");
  const [done, setDone] = useState(false);
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const lines = useMemo(() => visibleLatex.split("\n"), [visibleLatex]);

  const appliedEdits = useMemo(() => {
    if (done) return edits;
    if (activeEditIndex < 0) return [];
    return edits.slice(0, activeEditIndex + 1);
  }, [activeEditIndex, done, edits]);

  const lineMarks = useMemo(() => {
    const marks = new Map<number, { mark: LineMark; skill?: string }>();

    for (let i = 0; i < appliedEdits.length; i += 1) {
      const edit = appliedEdits[i]!;
      const isActive = !done && i === activeEditIndex;
      marks.set(edit.lineNumber, {
        mark: isActive ? "active" : edit.beforeLine === "" ? "added" : "changed",
        skill: edit.skill
      });
    }

    return marks;
  }, [appliedEdits, activeEditIndex, done]);

  useEffect(() => {
    if (!active || !edits.length) {
      setVisibleLatex(finalLatex || baseLatex);
      setActiveEditIndex(edits.length ? edits.length - 1 : -1);
      setDone(Boolean(edits.length));
      return;
    }

    let cancelled = false;
    setVisibleLatex(baseLatex);
    setActiveEditIndex(-1);
    setDone(false);
    setStatus("Opening LaTeX resume...");

    async function run() {
      await wait(500);
      if (cancelled) return;

      let current = baseLatex;

      for (let i = 0; i < edits.length; i += 1) {
        if (cancelled) return;
        const edit = edits[i]!;
        setActiveEditIndex(i);
        setStatus(edit.description);
        await wait(650);
        if (cancelled) return;

        current = applyEdit(current, edit);
        setVisibleLatex(current);
        await wait(900);
      }

      if (cancelled) return;
      setVisibleLatex(finalLatex);
      setActiveEditIndex(edits.length - 1);
      setDone(true);
      setStatus(`Done — ${edits.length} edit${edits.length === 1 ? "" : "s"} applied`);
      onAnimationDone?.();
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [active, baseLatex, finalLatex, edits, onAnimationDone]);

  useEffect(() => {
    if (activeEditIndex < 0) return;
    const lineNumber = edits[activeEditIndex]?.lineNumber;
    if (!lineNumber) return;
    const node = lineRefs.current[lineNumber];
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeEditIndex, edits]);

  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-slate-950/80 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-300">Live LaTeX editor</p>
          <p className="mt-1 text-sm text-slate-300">{status}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-amber-200">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Editing now
          </span>
          <span className="inline-flex items-center gap-1.5 text-emerald-200">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Changed
          </span>
          <span className="inline-flex items-center gap-1.5 text-sky-200">
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-400" /> Added line
          </span>
        </div>
      </div>

      {edits.length ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {edits.map((edit, index) => {
            const isActive = !done && index === activeEditIndex;
            const isDone = done || index < activeEditIndex;
            return (
              <span
                key={edit.id}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  isActive
                    ? "border-amber-300 bg-amber-400/25 text-amber-50 shadow-[0_0_12px_rgba(251,191,36,0.35)] animate-pulse"
                    : isDone
                      ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                      : "border-white/10 bg-slate-900 text-slate-500"
                }`}
              >
                {edit.skill} → {edit.row}
              </span>
            );
          })}
        </div>
      ) : null}

      <pre className="max-h-[420px] overflow-auto rounded-2xl border border-white/10 bg-[#070b14] p-4 font-mono text-[11px] leading-5 text-slate-300">
        {lines.map((line, index) => {
          const lineNumber = index + 1;
          const markInfo = lineMarks.get(lineNumber);
          const mark = markInfo?.mark ?? "normal";
          const skill = markInfo?.skill;

          return (
            <div
              key={`${lineNumber}-${line.slice(0, 24)}`}
              ref={(node) => {
                lineRefs.current[lineNumber] = node;
              }}
              className={`grid grid-cols-[3rem_1fr] gap-3 rounded-md px-1.5 py-0.5 transition ${rowClass(mark)}`}
            >
              <span className={`select-none text-right ${gutterClass(mark)}`}>{lineNumber}</span>
              <code className="whitespace-pre-wrap break-all">
                {skill ? renderHighlightedLine(line, skill, mark) : line || " "}
              </code>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

function rowClass(mark: LineMark) {
  switch (mark) {
    case "active":
      return "bg-amber-400/20 text-amber-50 ring-1 ring-amber-300/60 shadow-[inset_3px_0_0_0_rgb(251,191,36)] animate-pulse";
    case "added":
      return "bg-sky-500/15 text-sky-50 ring-1 ring-sky-400/40 shadow-[inset_3px_0_0_0_rgb(56,189,248)]";
    case "changed":
      return "bg-emerald-500/15 text-emerald-50 ring-1 ring-emerald-400/40 shadow-[inset_3px_0_0_0_rgb(52,211,153)]";
    default:
      return "";
  }
}

function gutterClass(mark: LineMark) {
  switch (mark) {
    case "active":
      return "text-amber-300 font-semibold";
    case "added":
      return "text-sky-300";
    case "changed":
      return "text-emerald-300";
    default:
      return "text-slate-600";
  }
}

function renderHighlightedLine(line: string, skill: string, mark: LineMark) {
  const index = line.toLowerCase().indexOf(skill.toLowerCase());
  if (index < 0) return line || " ";

  const before = line.slice(0, index);
  const match = line.slice(index, index + skill.length);
  const after = line.slice(index + skill.length);
  const chipClass =
    mark === "active"
      ? "rounded bg-amber-300 px-1 font-semibold text-slate-950"
      : mark === "added"
        ? "rounded bg-sky-300 px-1 font-semibold text-slate-950"
        : "rounded bg-emerald-300 px-1 font-semibold text-slate-950";

  return (
    <>
      {before}
      <span className={chipClass}>{match}</span>
      {after}
    </>
  );
}

function applyEdit(latex: string, edit: LatexEdit) {
  const lines = latex.split("\n");
  const index = edit.lineNumber - 1;

  if (edit.beforeLine === "") {
    lines.splice(Math.max(0, index), 0, edit.afterLine);
    return lines.join("\n");
  }

  if (index >= 0 && index < lines.length) {
    lines[index] = edit.afterLine;
    return lines.join("\n");
  }

  return latex.replace(edit.beforeLine, edit.afterLine);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
