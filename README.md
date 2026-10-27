# LeakCheck

Zcash public-exposure checker for ZECATHON (Core & Tooling).

## Problem
Users assume shielded Zcash means nothing is visible. Transparent inputs/outputs still publish amounts and t-addresses.

## Who
Anyone reviewing or about to rely on a Zcash payment path.

## What it does
Fetches public transaction data, applies fixed rules, shows what can be public, links an explorer, and exports a report. It does not decrypt shielded details or claim perfect anonymity.

## Verify
1. Open the live site.
2. Paste a real transaction ID (64 hexadecimal characters).
3. Confirm the verdict matches transparent activity shown by the linked explorer.
4. Paste a different transaction ID and confirm the result can change.
5. Try an invalid ID and confirm that the app returns an error rather than an analysis.

## Limits
- Not a Zcash node.
- Does not decrypt shielded data.
- Not a guarantee of anonymity.
- Depends on public indexer availability and the fields that indexer exposes.
- Missing input/output fields are treated as unknown, not proof of no exposure.
- Explorer indexing can be incomplete or delayed.

## Stack
Next.js App Router, TypeScript, Tailwind CSS, Vercel, Blockchair and CipherScan public endpoints.

## Run
```sh
npm i
npm run dev
```

## Data sources
- Blockchair Zcash transaction endpoint (mainnet primary).
- CipherScan mainnet and testnet transaction endpoints (fallback).
- Mainnet explorer: https://mainnet.zcashexplorer.app/transactions/
- Testnet explorer: https://testnet.cipherscan.app/

## Privacy
The txid is sent to public indexers from the server route to retrieve the transaction. Do not submit private keys, seed phrases, or viewing keys. No wallet connection, account, database, or paid API is used.

## Rules
- `TRANSPARENT_OUTPUT`: a transparent output signal, output value, or address is present.
- `TRANSPARENT_INPUT`: transparent input signals are present.
- `TRANSPARENT_ADDRESS`: a public transparent address is identified.
- `PARTIAL_EXPOSURE`: one or more transparent-exposure rules fired.
- `LOW_PUBLIC_EXPOSURE`: recognizable input and output fields were returned and no transparent signals were identified. This is not a privacy guarantee.
- `ERROR`: invalid txid, failed provider requests, or insufficient fields to make a reliable finding.

## Demo script (60–90 seconds)
1. Open the live site. “LeakCheck shows what a Zcash transaction exposes on the public chain.”
2. Paste a real txid with transparent activity and show its findings.
3. Open the explorer and compare the same txid.
4. Copy the report and paste it into a notes app.
5. Analyze a second txid, ideally with a different transparent/shielded shape.
6. Point out the disclaimer: “Real fetch, fixed rules, no fake score.”

## License
MIT
