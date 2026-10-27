import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Json = Record<string, any>;
type TxResult = {
  txid: string;
  network: "mainnet" | "testnet";
  transparentInCount: number | null;
  transparentOutCount: number | null;
  transparentAddresses: string[];
  transparentValuesVisible: boolean;
  rawNotes: string[];
  explorerUrl: string;
  source: string;
};

const TXID_RE = /^[a-fA-F0-9]{64}$/;
const MAIN_EXPLORER = "https://mainnet.zcashexplorer.app/transactions/";
const TEST_EXPLORER = "https://testnet.cipherscan.app/tx/";

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function getPath(obj: any, path: string[]): any {
  return path.reduce((value, key) => value?.[key], obj);
}
function firstArray(obj: any, paths: string[][]): any[] | null {
  for (const path of paths) {
    const value = getPath(obj, path);
    if (Array.isArray(value)) return value;
  }
  return null;
}
function addressOf(item: any): string | null {
  if (typeof item === "string" && /^(t1|t3|tm|t2)[1-9A-HJ-NP-Za-km-z]{20,}$/.test(item)) return item;
  if (!isObject(item)) return null;
  const candidates = [item.address, item.addr, item.recipient, item.scriptpubkey_address, item.scriptPubKey?.address, item.scriptPubKey?.addresses?.[0], item.script?.address, item.output_address];
  return candidates.find((v) => typeof v === "string" && /^(t1|t3|tm|t2)[1-9A-HJ-NP-Za-km-z]{20,}$/.test(v)) ?? null;
}
function hasVisibleValue(item: any): boolean {
  if (!isObject(item)) return false;
  return ["value", "amount", "valueZat", "value_zat", "valueZatoshis", "satoshis"].some((key) =>
    Object.prototype.hasOwnProperty.call(item, key) && item[key] !== null && item[key] !== undefined
  );
}
function collectNestedAddresses(value: any, out = new Set<string>(), depth = 0): Set<string> {
  if (depth > 7 || value == null) return out;
  const direct = addressOf(value);
  if (direct) out.add(direct);
  if (Array.isArray(value)) value.slice(0, 500).forEach((item) => collectNestedAddresses(item, out, depth + 1));
  else if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (/address|recipient|scriptpubkey/i.test(key)) collectNestedAddresses(child, out, depth + 1);
    }
  }
  return out;
}
function txContainer(body: any): any {
  if (!isObject(body)) return body;
  for (const key of ["data", "transaction", "tx", "result"]) {
    const value = body[key];
    if (isObject(value)) {
      if (value.txid || value.hash || value.vin || value.vout || value.inputs || value.outputs) return value;
      const nested = txContainer(value);
      if (nested !== value) return nested;
    }
  }
  return body;
}
function normalize(body: any, txid: string, network: "mainnet" | "testnet", source: string): TxResult {
  const tx = txContainer(body);
  if (!isObject(tx)) throw new Error("The explorer returned an unexpected transaction format.");
  const inputs = firstArray(tx, [["inputs"], ["vin"], ["transparentInputs"], ["transparent_inputs"], ["data", "inputs"], ["data", "vin"]]);
  const outputs = firstArray(tx, [["outputs"], ["vout"], ["transparentOutputs"], ["transparent_outputs"], ["data", "outputs"], ["data", "vout"]]);

  // Some indexers explicitly split transparent and shielded components. Prefer those explicit fields.
  const explicitIn = firstArray(tx, [["transparent", "inputs"], ["transparent", "vin"], ["transparentInputs"], ["transparent_inputs"]]);
  const explicitOut = firstArray(tx, [["transparent", "outputs"], ["transparent", "vout"], ["transparentOutputs"], ["transparent_outputs"]]);
  const inList = explicitIn ?? inputs;
  const outList = explicitOut ?? outputs;

  const addresses = collectNestedAddresses(tx);
  const transparentAddresses = [...addresses].filter((address) => network === "testnet" ? /^(tm|t2)/.test(address) : /^(t1|t3)/.test(address);
  const inputAddresses = new Set<string>();
  const outputAddresses = new Set<string>();
  (inList ?? []).forEach((item) => { const a = addressOf(item); if (a) inputAddresses.add(a); });
  (outList ?? []).forEach((item) => { const a = addressOf(item); if (a) outputAddresses.add(a); });

  // Counts remain unknown when the provider does not expose the corresponding structure.
  const transparentInCount = explicitIn ? explicitIn.length : inputs ? inputs.filter((item) => {
    const a = addressOf(item);
    return !!a || (isObject(item) && (item.type === "transparent" || item.type === "t"));
  }).length : null;
  const transparentOutCount = explicitOut ? explicitOut.length : outputs ? outputs.filter((item) => {
    const a = addressOf(item);
    return !!a || (isObject(item) && (item.type === "transparent" || item.type === "t"));
  }).length : null;
  const visibleOutValue = (outList ?? []).some((item) => hasVisibleValue(item) && (addressOf(item) || explicitOut !== null));
  const visibleAddresses = [...new Set([...transparentAddresses, ...inputAddresses, ...outputAddresses])];
  const notes: string[] = [];
  if (!inputs && !explicitIn) notes.push("Provider did not expose a recognizable input list; input exposure is unknown.");
  if (!outputs && !explicitOut) notes.push("Provider did not expose a recognizable output list; output exposure is unknown.");
  if (inputs && !explicitIn && transparentInCount === 0) notes.push("No transparent input address was identified in the provider's input list; this does not prove shielded details are absent.");
  if (outputs && !explicitOut && transparentOutCount === 0) notes.push("No transparent output address was identified in the provider's output list; this does not prove shielded details are absent.");
  if (visibleOutValue) notes.push("At least one transparent output value is present in the indexed response.");
  return {
    txid, network, transparentInCount, transparentOutCount,
    transparentAddresses: visibleAddresses,
    transparentValuesVisible: visibleOutValue,
    rawNotes: notes,
    explorerUrl: network === "testnet" ? TEST_EXPLORER + txid : MAIN_EXPLORER + txid,
    source,
  };
}
async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "LeakCheck/1.0" }, cache: "no-store", signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error("Indexer returned HTTP " + response.status);
  return response.json();
}

export async function GET(request: NextRequest) {
  const txid = (request.nextUrl.searchParams.get("txid") ?? "").trim();
  if (!TXID_RE.test(txid)) {
    return NextResponse.json({ verdict: "ERROR", error: "Enter a valid transaction ID containing exactly 64 hexadecimal characters." }, { status: 400 });
  }

  const failures: string[] = [];
  const providers: Array<{ url: string; network: "mainnet" | "testnet"; source: string }> = [
    { url: "https://api.blockchair.com/zcash/dashboards/transaction/" + txid, network: "mainnet", source: "Blockchair" },
    { url: "https://api.mainnet.cipherscan.app/api/tx/" + txid, network: "mainnet", source: "CipherScan Mainnet" },
    { url: "https://api.testnet.cipherscan.app/api/tx/" + txid, network: "testnet", source: "CipherScan Testnet" },
  ];

  for (const provider of providers) {
    try {
      const body = await fetchJson(provider.url);
      if (!isObject(body) || body.data === undefined && body.txid === undefined && body.tx === undefined && body.transaction === undefined && body.hash === undefined) {
        throw new Error("No recognizable transaction record returned.");
      }
      // Blockchair's dashboard wraps the record under data[txid].
      const payload = provider.source === "Blockchair" ? body.data?.[txid] : body;
      if (!payload) throw new Error("Transaction was not found in this indexer.");
      const result = normalize(payload, txid, provider.network, provider.source);
      if (result.transparentInCount === null && result.transparentOutCount === null) throw new Error("Indexer response does not include recognizable input/output fields.");
      const flags: string[] = [];
      if ((result.transparentOutCount ?? 0) > 0 || result.transparentValuesVisible || result.transparentAddresses.length > 0) flags.push("TRANSPARENT_OUTPUT");
      if ((result.transparentInCount ?? 0) > 0) flags.push("TRANSPARENT_INPUT");
      if (result.transparentAddresses.length > 0) flags.push("TRANSPARENT_ADDRESS");
      const hasUnknown = result.transparentInCount === null || result.transparentOutCount === null;
      const verdict = flags.length ? "PARTIAL_EXPOSURE" : hasUnknown ? "ERROR" : "LOW_PUBLIC_EXPOSURE";
      if (verdict === "ERROR") {
        return NextResponse.json({ verdict: "ERROR", error: "The indexer did not expose enough input/output information to make a reliable finding.", txid, network: result.network, source: result.source, rawNotes: result.rawNotes, explorerUrl: result.explorerUrl }, { status: 502 });
      }
      return NextResponse.json({ ...result, verdict, flags, fetchedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      failures.push(provider.source + ": " + (error instanceof Error ? error.message : "request failed"));
    }
  }
  return NextResponse.json({ verdict: "ERROR", error: "Could not retrieve a usable transaction record from public indexers. Check the txid and try again later.", details: failures }, { status: 502 });
}
