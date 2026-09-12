"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { openWorkingPaper } from "@/lib/workingPaper";

type Source = { n: number; title: string; slug: string; author: string; publishedAt: string; category: string };
type Turn = { role: "user" | "assistant"; content: string; sources?: Source[] };

const SUGGESTIONS = [
  "What do we have to do before the AI Act deadline in August?",
  "Do prompts belong in the audit file under ISA 230?",
  "Where does AI actually help in CSRD assurance?",
  "How should we test journal entries with LLMs?",
  "What did the AFM ask the OOB firms for?",
];

/** Minimal safe renderer: paragraphs, bold, [n] citation chips. */
function renderAnswer(text: string, sources: Source[] | undefined, onCite: (n: number) => void) {
  const paras = text.split(/\n{2,}/);
  return paras.map((p, pi) => {
    const parts: React.ReactNode[] = [];
    // tokenise on **bold** and [n]
    const re = /(\*\*[^*]+\*\*)|(\[(\d{1,2})\])/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(p))) {
      if (m.index > last) parts.push(p.slice(last, m.index));
      if (m[1]) {
        parts.push(<strong key={`${pi}-${m.index}`}>{m[1].slice(2, -2)}</strong>);
      } else if (m[3]) {
        const n = parseInt(m[3], 10);
        const src = sources?.find((s) => s.n === n);
        parts.push(
          src ? (
            <button
              key={`${pi}-${m.index}`}
              type="button"
              onClick={() => onCite(n)}
              className="f-mono mx-0.5 inline-block border px-1 text-[0.68em] align-super leading-tight rule-strong text-cream-400 hover:border-cream-400 hover:text-cream-100"
              title={src.title}
              aria-label={`Citation ${n}: ${src.title}`}
            >
              {n}
            </button>
          ) : (
            m[2]
          )
        );
      }
      last = m.index + m[0].length;
    }
    if (last < p.length) parts.push(p.slice(last));
    const isListItem = /^[-—•]\s/.test(p.trim());
    return (
      <p key={pi} className={`leading-relaxed ${isListItem ? "pl-4" : ""} ${pi > 0 ? "mt-3" : ""}`}>
        {parts}
      </p>
    );
  });
}

export default function AskConsole({
  authed,
  plan,
  quotaUsed,
  quotaLimit,
}: {
  authed: boolean;
  plan: "anon" | "free" | "plus";
  quotaUsed: number;
  quotaLimit: number; // -1 unlimited
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState({ used: quotaUsed, limit: quotaLimit });
  const [quotaHit, setQuotaHit] = useState<string | null>(null);
  const [savedIdx, setSavedIdx] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const lastSources = [...turns].reverse().find((t) => t.sources?.length)?.sources ?? [];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  function jumpToSource(n: number) {
    const el = document.getElementById(`ask-src-${n}`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el?.classList.add("!border-cream-400");
    setTimeout(() => el?.classList.remove("!border-cream-400"), 1200);
  }

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    setQuotaHit(null);
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((ts) => [...ts, { role: "user", content: question }, { role: "assistant", content: "" }]);

    try {
      abortRef.current = new AbortController();
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
        signal: abortRef.current.signal,
      });

      if (res.status === 402) {
        const j = await res.json();
        setTurns((ts) => ts.slice(0, -2));
        setQuotaHit(j.detail ?? "Quota reached.");
        return;
      }
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Ask STAI is unavailable right now");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let envelopeDone = false;
      let sources: Source[] = [];

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (!envelopeDone) {
          const sep = buffer.indexOf("\x1e");
          if (sep === -1) continue;
          const env = JSON.parse(buffer.slice(0, sep));
          sources = env.sources ?? [];
          if (env.quota) setQuota(env.quota);
          buffer = buffer.slice(sep + 1);
          envelopeDone = true;
          setTurns((ts) => {
            const next = [...ts];
            next[next.length - 1] = { role: "assistant", content: buffer, sources };
            return next;
          });
          continue;
        }
        const content = buffer;
        setTurns((ts) => {
          const next = [...ts];
          next[next.length - 1] = { role: "assistant", content, sources };
          return next;
        });
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setTurns((ts) => {
          const next = [...ts];
          next[next.length - 1] = {
            role: "assistant",
            content: "Something went wrong reaching the desk — try again.",
          };
          return next;
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveAnswer(idx: number) {
    const t = turns[idx];
    const q = turns[idx - 1]?.content ?? "";
    const res = await fetch("/api/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, answer: t.content, sources: t.sources ?? [] }),
    });
    if (res.ok) setSavedIdx((s) => new Set(s).add(idx));
  }

  function exportAnswer(idx: number) {
    const t = turns[idx];
    const q = turns[idx - 1]?.content ?? "";
    openWorkingPaper({
      kind: "ASK-STAI ANSWER",
      title: q,
      body: t.content.replace(/\*\*/g, ""),
      sources: (t.sources ?? []).map((s) => ({
        n: s.n,
        label: `${s.title} — ${s.author}, STAI, ${s.publishedAt}`,
        href: `stai.ai/briefing/${s.slug}`,
      })),
    });
  }

  const quotaLabel =
    plan === "plus"
      ? "STAI+ · unlimited"
      : quota.limit === -1
        ? ""
        : `${Math.max(0, quota.limit - quota.used)} of ${quota.limit} questions left this month`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {/* console */}
      <div className="flex min-h-[32rem] flex-col border bg-navy-950 rule-strong">
        <div className="flex items-center justify-between border-b px-4 py-2.5 rule">
          <span className="f-label" style={{ color: "var(--ink-faint)" }}>
            Ask STAI — grounded in the desk&apos;s published research
          </span>
          <span className="f-mono text-[0.62rem] tracking-[0.1em] uppercase" style={{ color: plan === "plus" ? "var(--color-gold-300)" : "var(--ink-faint)" }}>
            {quotaLabel}
          </span>
        </div>

        <div ref={scrollRef} className="panel-scroll flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
          {turns.length === 0 && (
            <div>
              <p className="f-mono text-[0.78rem] text-cream-400">
                <span style={{ color: "var(--ink-faint)" }}>stai ›</span> Ask anything the desk has covered —
                answers cite their sources, and say so when the shelf is empty.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="border px-3 py-1.5 text-left text-[0.8rem] rule text-cream-400 transition-colors hover:border-[var(--line-strong)] hover:text-cream-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) =>
            t.role === "user" ? (
              <p key={i} className="f-mono text-[0.82rem] text-cream-100">
                <span style={{ color: "var(--ink-faint)" }}>you ›</span> {t.content}
              </p>
            ) : (
              <div key={i} className="border-l-2 pl-4" style={{ borderColor: "var(--line-strong)" }}>
                <div className={`text-[0.92rem] text-cream-200 ${busy && i === turns.length - 1 ? "cursor-blink" : ""}`}>
                  {renderAnswer(t.content, t.sources, jumpToSource)}
                </div>
                {!busy && t.content && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => exportAnswer(i)} className="f-mono border px-2.5 py-1 text-[0.62rem] tracking-[0.1em] uppercase rule text-cream-400 hover:border-[var(--line-strong)] hover:text-cream-100">
                      Export working paper
                    </button>
                    {plan === "plus" && (
                      <button
                        type="button"
                        onClick={() => saveAnswer(i)}
                        disabled={savedIdx.has(i)}
                        className="f-mono border px-2.5 py-1 text-[0.62rem] tracking-[0.1em] uppercase rule text-cream-400 hover:border-[var(--line-strong)] hover:text-cream-100 disabled:opacity-60"
                      >
                        {savedIdx.has(i) ? "Saved to desk ✓" : "Save answer"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          )}

          {quotaHit && (
            <div className="border p-5" style={{ borderColor: "var(--gold-line)", background: "rgba(201,168,76,0.05)" }}>
              <p className="f-mono text-[0.65rem] font-bold tracking-[0.16em] uppercase text-gold-300">Quota reached</p>
              <p className="mt-2 text-sm text-cream-200">{quotaHit}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href="/plus" className="btn btn-plus premium-focus">
                  Go unlimited with STAI+
                </Link>
                {!authed && (
                  <Link href="/signup?next=/ask" className="btn btn-ghost">
                    Create a free account
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex gap-2 border-t p-3 rule"
        >
          <label htmlFor="ask-input" className="sr-only">
            Ask STAI a question
          </label>
          <input
            id="ask-input"
            className="input-stai f-mono text-[0.85rem]"
            placeholder="Ask the desk…"
            value={input}
            maxLength={500}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary" disabled={busy || input.trim().length < 3}>
            {busy ? "…" : "Ask"}
          </button>
        </form>
      </div>

      {/* sources rail */}
      <aside className="lg:sticky lg:top-32 lg:self-start" ref={sourcesRef}>
        <p className="f-label border-b pb-2 rule-strong" style={{ color: "var(--ink-faint)" }}>
          Sources on the desk
        </p>
        {lastSources.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
            Citations for each answer land here — every claim traceable to a published STAI briefing, one click
            away. That&apos;s the deal: no source, no sentence.
          </p>
        ) : (
          <ol className="mt-3 space-y-3">
            {lastSources.map((s) => (
              <li key={s.n} id={`ask-src-${s.n}`} className="border p-3 transition-colors rule">
                <p className="f-mono text-[0.62rem] tracking-[0.1em] uppercase" style={{ color: "var(--ink-faint)" }}>
                  [{s.n}] {s.category} · {s.publishedAt}
                </p>
                <Link href={`/briefing/${s.slug}`} className="mt-1 block text-sm font-medium leading-snug text-cream-100 underline-offset-4 hover:underline">
                  {s.title}
                </Link>
                <p className="f-mono mt-1 text-[0.62rem]" style={{ color: "var(--ink-faint)" }}>
                  {s.author}
                </p>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
