# Secuty Whitepaper

Version 0.1, design draft. Nothing described here is deployed.

## 1. Summary

Secuty is a protection protocol for wallets on Robinhood Chain. It lets an owner write the rules that govern an account, lets AI agents work inside those rules, and keeps identity data sealed while still allowing apps to verify what they need. Large movements of value are signed with schemes meant to hold up against future quantum computers.

The guiding sentence is short: **models flag, rules decide, owners hold the keys.**

## 2. The problem

Three trends collide.

- **Speed.** Software agents can turn a stated goal into dozens of onchain actions before a person reads the first one.
- **Opaque approvals.** A signature prompt rarely shows what a request will change. Open-ended allowances and lookalike contracts exploit that gap.
- **Aging cryptography.** Signatures that are safe today may not stay safe for the lifetime of a long-held account.

Existing wallets treat a key as total authority. Whoever holds it can do anything. That model has no room for "this actor may spend a little, at these apps, until Friday".

## 3. Design principles

1. **Rules over predictions.** Anything that can move funds is deterministic and written by the owner. A model may inform a rule's input; it may never replace the rule.
2. **Least authority.** Every actor gets the narrowest key that does its job, and that key expires.
3. **Prove, don't disclose.** An app should learn that a statement is true, not receive the documents behind it.
4. **Crypto agility.** Signature schemes must be swappable without moving funds.
5. **Honest scope.** The privacy layer protects credentials. It does not claim to hide every transaction on the chain.

## 4. System overview

A request travels through four stops. See [architecture.md](architecture.md) for the component view.

1. **Declare.** The owner or a scoped agent key submits an intent.
2. **Screen.** The intent is replayed against a private copy of chain state. Effects, allowances and onward calls are extracted and scored.
3. **Authorize.** The wallet compares the replay with the owner's rules and returns allow, deny, or escalate.
4. **Sign.** Allowed requests are signed and broadcast. Escalated requests wait for the stronger proof the rule demands.

## 5. Modules

### 5.1 Wallet
The account contract. It records holders, per-actor permissions, ceilings, saved destinations, recovery paths and an emergency pause. Recovery does not hinge on any single key.

### 5.2 Screening
Adaptive models that read a replay and produce a short, readable note: what moves, what is granted, why it looks unusual. Output is advisory input to the rulebook, never an authorization.

### 5.3 Agent rails
Each AI agent receives its own key with chosen apps, chosen assets, a daily cap and an expiry. Agents cannot widen their own lane; only an owner signature can.

### 5.4 Future-proof signing
Owners register backup keys and a threshold above which a second, quantum-resistant signature is required. The scheme is a parameter, not a hard-coded choice.

### 5.5 Credentials and sealed proofs
Identity facts, eligibility and reputation are held by the owner. A zero-knowledge verification layer lets an app confirm a claim without receiving the underlying data.

### 5.6 Shared watchlist
A community-fed list of known-bad contracts and patterns that feeds Screening. Contributions are attributed and reviewable.

## 6. Threat model (summary)

| Threat | Mitigation |
| --- | --- |
| Stolen everyday key | Ceilings, saved destinations and pause cap the loss |
| Malicious allowance | Replay surfaces it; a standing rule can refuse open-ended grants |
| Over-eager or hijacked agent | Narrow expiring key, hard caps, app and asset lists |
| Phishing contract | Lookalike detection plus the watchlist |
| Future quantum attacker | Swappable schemes; stronger signature on large moves |
| Credential leakage | Sealed proofs; apps receive answers, not files |
| Model error | Models cannot authorize; rules are deterministic |

Out of scope for v0.1: protecting against a compromised owner device that holds every key and signs willingly, and hiding transaction metadata.

## 7. Open questions

- Which quantum-resistant scheme fits Robinhood Chain's execution costs best.
- How much replay can run client-side versus in a shared service.
- Governance of the shared watchlist and dispute handling.
- Audit scope and sequencing against the [roadmap](roadmap.md).

## 8. Disclaimer

This document describes intent. It is not an offer, a financial promise or a guarantee of delivery. No dates are committed.
