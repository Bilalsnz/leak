"use client";

import { FormEvent, useMemo, useState } from "react";

type Analysis = {
  txid: string; network: "mainnet" | "testnet"; transparentInCount: number | null; transparentOutCount: number | null;
  transparentAddresses: string[]; transparentValuesVisible: boolean; rawNotes: string[]; explorerUrl: string;
  source: string; verdict: "PARTIAL_EXPOSURE" | "LOW_PUBLIC_EXPOSURE" | "ERROR"; flags?: string[];
  fetchedAt?: string; error?: string;
};

const DISCLAIMER = "Not a full anonymity proof. Public index data only.";
function shortTx(txid: string) { return txid.slice(0, 10) + "…" + txid.slice(-8); }

export default function Home() {
  const [txid, setTxid] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const report = useMemo(() => {
    if (!analysis) return "";
    return [
      "LeakCheck report",
      "txid: " + analysis.txid,
      "network: " + analysis.network,
      "verdict: " + analysis.verdict,
      "flags: " + ((analysis.flags?.length ? analysis.flags.join(", ") : "none identified")),
      "transparent addresses: " + (analysis.transparentAddresses.length ? analysis.transparentAddresses.slice(0, 8).join(", ") : "none identified in fetched public fields"),
      "transparent inputs: " + (analysis.transparentInCount === null ? "unknown" : analysis.transparentInCount),
      "transparent outputs: " + (analysis.transparentOutCount === null ? "unknown" : analysis.transparentOutCount),
      "transparent output values visible: " + (analysis.transparentValuesVisible ? "yes" : "not identified"),
      "source: " + analysis.source,
      "explorer: " + analysis.explorerUrl,
      "generated: " + (analysis.fetchedAt ?? new Date().toISOString()),
      "disclaimer: " + DISCLAIMER,
    ].join("\n");
  }, [analysis]);

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setAnalysis(null); setCopied(false);
    const clean = txid.trim();
    if (!/^[a-fA-F0-9]{64}$/.test(clean)) {
      setError("ERROR: A transaction ID must contain exactly 64 hexadecimal characters.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/analyze?txid=" + encodeURIComponent(clean), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data.verdict === "ERROR") {
        setError(data.error || "The transaction could not be analyzed from public index data.");
        return;
      }
      setAnalysis(data as Analysis);
    } catch {
      setError("Could not reach LeakCheck. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyReport() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard access was blocked. Select and copy the report from the browser instead.");
    }
  }

  const partial = analysis?.verdict === "PARTIAL_EXPOSURE";
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="grid-glow pointer-events-none absolute inset-x-0 top-0 h-[560px]" />
      <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <a href="/" className="flex items-center gap-3" aria-label="LeakCheck home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-yellow-300/40 bg-yellow-300/10 text-xl font-black text-yellow-300">L<span className="text-green-300">.</span></span>
            <span><span className="block text-lg font-bold tracking-tight">LeakCheck</span><span className="block text-[10px] font-semibold uppercase tracking-[.23em] text-slate-500">Zcash path preflight</span></span>
          </a>
          <div className="hidden items-center gap-2 rounded-full border border-green-300/20 bg-green-300/5 px-3 py-1.5 text-xs text-green-200 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-green-300" /> Public data only</div>
          <span className="rounded-full border border-sky-300/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-sky-200 sm:hidden">Core & Tooling</span>
        </header>

        <section className="mx-auto max-w-3xl pb-8 pt-12 text-center sm:pt-16">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-yellow-300/25 bg-yellow-300/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-yellow-200"><span className="h-1.5 w-1.5 rounded-full bg-yellow-300" /> ZECATHON · CORE & TOOLING</div>
          <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-6xl">Privacy starts with<br className="hidden sm:block" /> knowing what <span className="text-yellow-300">leaks.</span></h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">See what a Zcash transaction exposes on the public chain.</p>
          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-white/10 bg-[#0b1823]/90 p-2 shadow-2xl shadow-black/30 sm:p-3">
            <form onSubmit={analyze} className="flex flex-col gap-2 sm:flex-row">
              <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-[#071019] px-4">
                <svg className="h-4 w-4 shrink-0 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg>
                <input value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="Paste txid (64 hex characters)" spellCheck={false} autoCapitalize="off" autoCorrect="off" className="h-12 min-w-0 w-full bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-600 sm:text-sm" aria-label="Zcash transaction ID" />
              </label>
              <button disabled={loading} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-yellow-300 px-6 text-sm font-extrabold text-[#111a20] transition hover:bg-yellow-200 disabled:cursor-wait disabled:opacity-70">
                {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-800/30 border-t-slate-900"/> Checking…</> : <>Analyze <span aria-hidden="true">↗</span></>}
              </button>
            </form>
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-1 pt-3 text-[10px] text-slate-500"><span>Read-only · No wallet · No login</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-sky-300"/> Mainnet first · testnet fallback</span></div>
          </div>
          {error && <div role="alert" className="mx-auto mt-4 max-w-2xl rounded-xl border border-red-400/30 bg-red-400/[0.08] px-4 py-3 text-left text-sm text-red-200"><span className="mr-2 font-bold">ERROR · Unable to analyze</span>{error}</div>}
        </section>

        {analysis && <section className="mx-auto max-w-5xl animate-[fadeIn_.25s_ease-out]">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div><div className="text-[10px] font-bold uppercase tracking-[.22em] text-slate-500">Analysis result</div><div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-300"><span className="font-mono">{shortTx(analysis.txid)}</span><span className="rounded-md border border-sky-300/20 bg-sky-300/[.06] px-2 py-1 text-[10px] uppercase tracking-wider text-sky-200">{analysis.network}</span><span className="text-xs text-slate-500">via {analysis.source}</span></div></div>
            <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-xs font-extrabold tracking-wide ${partial ? "border-yellow-300/30 bg-yellow-300/10 text-yellow-200" : "border-green-300/30 bg-green-300/10 text-green-200"}`}><span className={`h-2 w-2 rounded-full ${partial ? "bg-yellow-300" : "bg-green-300"}`}/>{partial ? "PARTIAL_EXPOSURE" : "LOW_PUBLIC_EXPOSURE"}</div>
          </div>
          <div className="panel rounded-2xl p-5 sm:p-7">
            <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start">
              <div><div className="text-[10px] font-bold uppercase tracking-[.22em] text-slate-500">Verdict</div><h2 className={`mt-2 text-2xl font-black sm:text-3xl ${partial ? "text-yellow-200" : "text-green-200"}`}>{partial ? "Partial exposure" : "Low public exposure (transparent view)"}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{partial ? "Transparent components were found. Amounts and/or t-addresses on that side can be linked on-chain." : "No transparent inputs/outputs in the public data we fetched. That does not prove the full path is private forever."}</p></div>
              <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 sm:min-w-[142px]"><div className="text-[10px] uppercase tracking-widest text-slate-500">Checklist</div><div className="mt-1 text-2xl font-black text-sky-200">{analysis.flags?.length ?? 0}<span className="ml-1 text-xs font-medium text-slate-500">flags</span></div><div className="mt-1 text-[10px] text-slate-500">Fixed rules, no score</div></div>
            </div>
            <div className="grid gap-4 py-5 md:grid-cols-2">
              <div className="rounded-xl border border-green-300/15 bg-green-300/[.035] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-green-200"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-300/10">✓</span> Stays private / not shown as transparent</div>
                <ul className="space-y-2 text-xs leading-5 text-slate-400">
                  <li>• Shielded addresses and shielded amounts are not publicly readable from the transparent transaction view.</li>
                  <li>• This checker does not decrypt shielded internals or infer private recipients.</li>
                  <li>• {analysis.transparentInCount === 0 && analysis.transparentOutCount === 0 ? "No transparent input/output records were identified in this indexer response." : "Shielded details remain outside the transparent fields inspected here."}</li>
                </ul>
              </div>
              <div className="rounded-xl border border-yellow-300/15 bg-yellow-300/[.035] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-yellow-200"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-300/10">!</span> Can become public</div>
                <ul className="space-y-2 text-xs leading-5 text-slate-400">
                  {analysis.flags?.length ? analysis.flags.map((flag) => <li key={flag} className="break-words"><span className="mr-2 text-yellow-200">•</span><span className="font-mono text-yellow-100">{flag}</span></li>) : <li>• No transparent-exposure flags were identified in the available fields.</li>}
                  {analysis.transparentAddresses.slice(0, 8).map((address) => <li key={address} className="break-all font-mono text-[11px] text-slate-300">↳ {address}</li>)}
                  {analysis.transparentAddresses.length > 8 && <li className="text-slate-500">+ {analysis.transparentAddresses.length - 8} more addresses</li>}
                  {analysis.transparentValuesVisible && <li>• Transparent output values are visible in the indexed response and may be linkable on-chain.</li>}
                </ul>
              </div>
            </div>
            <div className="rounded-xl border border-sky-300/15 bg-sky-300/[.035] p-4"><div className="text-[10px] font-bold uppercase tracking-[.2em] text-sky-200">Why this verdict?</div><p className="mt-2 text-sm leading-6 text-slate-300">{partial ? "At least one transparent input/output signal or transparent address was found in the public index response." : "The fetched response exposed recognizable input/output fields, but no transparent inputs or outputs were identified. This is not a proof of perfect privacy."}</p>{analysis.rawNotes.map((note) => <p key={note} className="mt-2 text-xs leading-5 text-slate-500">{note}</p>)}</div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <a href={analysis.explorerUrl} target="_blank" rel="noreferrer" className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-sky-300 px-4 text-sm font-bold text-[#071019] transition hover:bg-sky-200">Open in explorer <span>↗</span></a>
              {analysis.network === "mainnet" && <a href={"https://blockchair.com/zcash/transaction/" + analysis.txid} target="_blank" rel="noreferrer" className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-sky-300/25 bg-sky-300/[.06] px-4 text-sm font-bold text-sky-100 transition hover:bg-sky-300/[.12]">Blockchair ↗</a>}
              <button onClick={copyReport} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[.035] px-4 text-sm font-bold text-slate-100 transition hover:bg-white/[.08]">{copied ? "✓ Report copied" : "Copy report"}</button>
            </div>
            <p className="mt-3 break-all text-center font-mono text-[10px] text-slate-600">{analysis.txid}</p>
          </div>
        </section>}

        <section className="mx-auto mt-10 grid max-w-5xl gap-3 sm:grid-cols-3">
          {[{n:"01",title:"Fetch public data",body:"Read-only transaction lookup from public indexers."},{n:"02",title:"Apply fixed rules",body:"Transparent input/output signals, not a privacy score."},{n:"03",title:"Inspect the evidence",body:"Open the explorer or copy a report you can verify."}].map((item) => <div key={item.n} className="rounded-xl border border-white/[.07] bg-white/[.018] p-4"><div className="text-xs font-black text-yellow-300">{item.n}</div><h3 className="mt-3 text-sm font-bold text-slate-200">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{item.body}</p></div>)}
        </section>
        <footer className="mx-auto mt-12 max-w-5xl border-t border-white/10 pt-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="text-xs font-bold text-slate-400">LeakCheck <span className="font-normal text-slate-600">· Zcash public-exposure checker</span></div><div className="text-[10px] font-semibold uppercase tracking-[.17em] text-sky-200">ZECATHON · Core & Tooling</div></div>
          <p className="mt-3 max-w-4xl text-[11px] leading-5 text-slate-600">Not a full anonymity proof. Not a Zcash node. Uses public explorer/index data only. Shielded internals are not decrypted. For planning and review only. ZECATHON · Core & Tooling.</p>
        </footer>
      </div>
      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </main>
  );
}
