# 🪓 ANVL Claim dApp (v1 Vesting Contract Interface)

## Overview

This project is a **proof-of-concept** web interface for interacting with the original **ANVL v1 vesting contract** on Ethereum.

When the ANVL project first launched, participants who staked to **Capacity** and validated their claims within the snapshot window received **locked tokens** that were to vest linearly over **five years**. This gradual unlock schedule reflected the original intent: to align with long-term contributors and support a slow, sustainable release cycle.

Later, the **ANVL contract was updated to v2**, removing the vesting schedule and allowing all tokens to be claimed immediately. While that change simplified distribution, it effectively **bypassed the original time-based vesting model** — something I personally disagreed with.

When the official ANVL site removed its v1 GUI, there was **no longer a way to claim tokens** from the original vesting contract. Since those tokens were legitimately earned under the original terms, I built this simple web app to connect directly to the **verified v1 contract** and claim the remaining tokens.

---

## 🔍 Purpose

This app:
- Connects directly to the **original ANVL v1 vesting contract** on Ethereum mainnet  
- Allows wallet owners who participated in the original **Capacity staking + snapshot** to:
  - View vesting progress (total, claimed, claimable)
  - Claim available tokens according to the vesting schedule
- Recreates the missing interface that used to exist on the ANVL website

---

## ⚙️ Technical Summary

- **Frontend Framework:** Next.js (React) + Tailwind CSS  
- **Blockchain Library:** ethers.js v6  
- **Deployment:** GitHub Pages (static export)  
- **Contract Sources:**
  - Token: [`0x2Ca9242c1810029Efed539F1c60D68B63AD01BFc`](https://etherscan.io/token/0x2Ca9242c1810029Efed539F1c60D68B63AD01BFc)
  - Vesting: dynamically fetched from the token’s `claimContract()` function

---

## 🧠 Key Features

- Wallet chooser (MetaMask, Coinbase, Brave, etc.)
- Ethereum Mainnet guard (auto-switch or prompt user)
- Dynamic fetch of vesting contract address
- Real-time readout:
  - Allocation
  - Claimed amount
  - Vesting start + period
  - Claimable now (estimated)
- “Max claimable now” button
- Manual claim with gas-controlled transaction
- Read-only safety — the vesting logic is fully on-chain

---

## ⚠️ Disclaimer

This app is **unofficial**, **unaudited**, and provided **as-is** for personal, educational, and archival purposes.

- **Use at your own risk.**  
- Always verify contract addresses before interacting.  
- The original ANVL team and associated entities are **not affiliated** with this project.  
- No guarantees are made regarding contract functionality, token balances, or outcomes of any on-chain transactions.

---

## 🧩 Motivation

> “I liked the idea of a gradual, five-year rollout — a long-term, value-aligned release cycle.  
> When that idea disappeared, I wanted to preserve the original spirit of the project.”

This project exists purely to let early participants access their rightful tokens under the v1 rules — nothing more, nothing less.

---

## 🧰 Local Development

```bash
# Install dependencies
npm install

# Start dev server (hot reload)
npm run dev

# Static export build (for GitHub Pages)
npm run build
npx serve out
