"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * ANVL Vesting Claim – Next.js (App Router) single-page component
 * ---------------------------------------------------------------
 * Polished, dependency-light React page that connects to a vesting contract
 * and lets users claim tokens. Uses the EIP-1193 provider (e.g., MetaMask)
 * via ethers v6, loaded dynamically in the browser.
 *
 * HOW TO USE
 * 1) Install deps:  npm i ethers
 * 2) Create a new file (e.g., app/page.tsx) and paste this entire file in.
 * 3) Start dev server: npm run dev
 *
 * Optional: Tailwind CSS recommended for styling. If you have it, the classes
 * below will render nicely. Without Tailwind, it still works, just less pretty.
 */

// ---- Settings ----
const VESTING_CONTRACT = "0xEFd19D4Df955E8958d132319F31D2aB97fE29Ac" as const;
const TOKEN_DECIMALS = 18; // change if your token uses a different decimals()

// Minimal ABI for required reads + claim
const VESTING_ABI = [
  "function vestingStartTimestamp() view returns (uint32)",
  "function vestingPeriodSeconds() view returns (uint32)",
  "function provenBalances(address) view returns (uint256 initial, uint256 claimed)",
  "function getProvenUnclaimedBalance(address) view returns (uint256)",
  "function claim(uint256 _amount)"
] as const;

// Lightweight formatter helpers
function fmtNumber(n: number | string, max = 6) {
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return String(n);
  return num.toLocaleString(undefined, { maximumFractionDigits: max });
}

function toISO(tsSeconds?: number | string) {
  if (!tsSeconds) return "—";
  const n = typeof tsSeconds === "string" ? Number(tsSeconds) : tsSeconds;
  const d = new Date(n * 1000);
  return Number.isFinite(d.valueOf()) ? d.toISOString().replace(".000Z", "Z") : "—";
}

function assertBrowser() {
  if (typeof window === "undefined") throw new Error("Must run in the browser.");
}

export default function Page() {
  const [ethersMod, setEthersMod] = useState<any>(null);
  const [hasProvider, setHasProvider] = useState(false);

  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const [initial, setInitial] = useState<bigint | null>(null);
  const [claimed, setClaimed] = useState<bigint | null>(null);
  const [unclaimedTotal, setUnclaimedTotal] = useState<bigint | null>(null);
  const [startTs, setStartTs] = useState<number | null>(null);
  const [periodSec, setPeriodSec] = useState<number | null>(null);

  const [suggested, setSuggested] = useState<string>("");
  const [amountTokens, setAmountTokens] = useState<string>("");

  const [txhash, setTxhash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const contractRef = useRef<any>(null);
  const signerRef = useRef<any>(null);

  // Load ethers only in the client
  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;
      try {
        const mod = await import("ethers");
        setEthersMod(mod);
        setHasProvider(!!(window as any).ethereum);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const isReady = useMemo(() => Boolean(ethersMod && hasProvider), [ethersMod, hasProvider]);

  const connect = useCallback(async () => {
    try {
      assertBrowser();
      setErr(null);
      setTxhash(null);
      if (!isReady) throw new Error("Wallet provider or ethers not available");
      const { BrowserProvider, Contract } = ethersMod;
      const provider = new BrowserProvider((window as any).ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      signerRef.current = signer;
      const userAddr = await signer.getAddress();
      const net = await provider.getNetwork();
      setChainId(Number(net.chainId));
      setAddress(userAddr);
      contractRef.current = new Contract(VESTING_CONTRACT, VESTING_ABI, signer);
      await refreshReads();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }, [ethersMod, isReady]);

  const refreshReads = useCallback(async () => {
    try {
      setErr(null);
      setTxhash(null);
      const c = contractRef.current;
      if (!c) throw new Error("Not connected");

      const [start, period, pb, unclaimed] = await Promise.all([
        c.vestingStartTimestamp(),
        c.vestingPeriodSeconds(),
        c.provenBalances(address),
        c.getProvenUnclaimedBalance(address)
      ]);

      setStartTs(Number(start));
      setPeriodSec(Number(period));
      setInitial(pb.initial as bigint);
      setClaimed(pb.claimed as bigint);
      setUnclaimedTotal(BigInt(unclaimed));

      // Compute claimable now (linear vesting) & propose a small default claim
      const now = Math.floor(Date.now() / 1000);
      const elapsed = Math.max(0, now - Number(start));
      const frac = Math.min(1, elapsed / Number(period || 1));

      // Use integer math for BigInt: vested ≈ initial * frac
      const SCALE = 1_000_000_000;
      const vested = (BigInt(pb.initial) * BigInt(Math.floor(frac * SCALE))) / BigInt(SCALE);
      const claimableNow = vested - BigInt(pb.claimed);

      // Default suggestion: min(10,000, claimableNow)
      if (claimableNow > 0n) {
        const suggestedWei = claimableNow > parseUnitsBI("10000", TOKEN_DECIMALS)
          ? parseUnitsBI("10000", TOKEN_DECIMALS)
          : claimableNow;
        const sHuman = formatUnitsBI(suggestedWei, TOKEN_DECIMALS);
        setSuggested(sHuman);
        if (!amountTokens) setAmountTokens(sHuman);
      } else {
        setSuggested("0");
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }, [address, amountTokens]);

  const doClaim = useCallback(async () => {
    try {
      setErr(null);
      setTxhash(null);
      if (!contractRef.current) throw new Error("Not connected");
      const input = (amountTokens || "").trim();
      if (!input || Number(input) <= 0) throw new Error("Enter a positive token amount");
      const amt = parseUnitsBI(input, TOKEN_DECIMALS);
      setLoading(true);
      const tx = await contractRef.current.claim(amt);
      setTxhash(tx.hash);
      await tx.wait();
      await refreshReads();
    } catch (e: any) {
      // ethers v6 may expose .reason; else use .message
      setErr(e?.reason || e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [amountTokens, refreshReads]);

  // BigInt <-> decimal helpers w/o pulling extra libs
  function formatUnitsBI(value: bigint, decimals: number) {
    const neg = value < 0n;
    const v = neg ? -value : value;
    const base = 10n ** BigInt(decimals);
    const whole = v / base;
    const frac = v % base;
    const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
    return `${neg ? "-" : ""}${whole.toString()}${fracStr ? "." + fracStr : ""}`;
  }
  function parseUnitsBI(str: string, decimals: number) {
    const [w = "0", f = ""] = str.split(".");
    const frac = (f + "".padEnd(decimals, "0")).slice(0, decimals);
    const whole = BigInt(w);
    const fracBI = BigInt(frac || "0");
    return whole * 10n ** BigInt(decimals) + fracBI;
  }

  const dailyRate = useMemo(() => {
    if (!initial || !periodSec) return null;
    const perDay = (Number(initial) / 10 ** TOKEN_DECIMALS) / (Number(periodSec) / 86400);
    return perDay;
  }, [initial, periodSec]);

  const connected = Boolean(address);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">ANVL Vesting Claim</h1>
          <p className="text-sm text-gray-500">Securely read your vesting status and claim tokens directly from the verified contract.</p>
        </div>
        <button
          onClick={connect}
          className="rounded-xl border px-4 py-2 shadow-sm hover:shadow transition"
        >
          {connected ? "Reconnect" : "Connect Wallet"}
        </button>
      </header>

      <section className="border rounded-2xl p-4 md:p-6 shadow-sm mb-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">Address</div>
            <div className="font-mono break-all">{address ?? "—"}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Network</div>
            <div>{chainId ? `chainId ${chainId}` : "—"}</div>
          </div>
        </div>
      </section>

      <section className="border rounded-2xl p-4 md:p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-3">Your Vesting Status</h2>
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <div>
            <div className="text-sm text-gray-500">Initial Allocation</div>
            <div className="font-semibold">{initial !== null ? fmtNumber(Number(formatUnitsBI(initial, TOKEN_DECIMALS))) : "—"}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Already Claimed</div>
            <div className="font-semibold">{claimed !== null ? fmtNumber(Number(formatUnitsBI(claimed, TOKEN_DECIMALS))) : "—"}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Vesting Start (UTC)</div>
            <div className="font-semibold">{startTs ? toISO(startTs) : "—"}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Vesting Period</div>
            <div className="font-semibold">{periodSec ? `${fmtNumber(periodSec)} sec (~${fmtNumber(periodSec/86400)} days)` : "—"}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Unclaimed (contract)</div>
            <div className="font-semibold">{unclaimedTotal !== null ? fmtNumber(Number(formatUnitsBI(unclaimedTotal, TOKEN_DECIMALS))) : "—"}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Daily Unlock (est.)</div>
            <div className="font-semibold">{dailyRate ? `${fmtNumber(dailyRate)} tokens/day` : "—"}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={refreshReads} className="rounded-lg border px-3 py-1.5 shadow-sm hover:shadow">Refresh</button>
          {suggested && <div className="text-sm text-gray-500">Suggested test claim: <span className="font-semibold">{fmtNumber(suggested)}</span> tokens</div>}
        </div>
      </section>

      <section className="border rounded-2xl p-4 md:p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-3">Claim</h2>
        <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-sm text-gray-500 mb-1" htmlFor="amt">Amount (tokens)</label>
            <input
              id="amt"
              type="number"
              inputMode="decimal"
              step="0.000000000000000001"
              placeholder="e.g. 10000"
              value={amountTokens}
              onChange={(e) => setAmountTokens(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Tip: test with a small amount first; gas costs are similar for small vs large claims.</p>
          </div>
          <button
            onClick={doClaim}
            disabled={!connected || loading}
            className="rounded-xl border px-4 py-2 shadow-sm hover:shadow disabled:opacity-50"
          >
            {loading ? "Claiming…" : "Claim"}
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-600">
          <div><span className="text-gray-500">Tx hash:</span> <span className="font-mono break-all">{txhash ?? "—"}</span></div>
          <div className="mt-1"><span className="text-gray-500">Errors:</span> <span className="font-mono break-all">{err ?? "—"}</span></div>
        </div>
      </section>

      <footer className="text-xs text-gray-500 mt-8">
        <p>Powered by a verified vesting contract at <span className="font-mono">{VESTING_CONTRACT}</span>. This page does not store keys or funds; transactions are signed in your wallet.</p>
      </footer>
    </main>
  );
}
