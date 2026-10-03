# Roadmap

The roadmap shows **order of work**, not dates. No ship dates are committed. Stage 01 is in active design; later stages are queued.

| Stage | Name | State |
| --- | --- | --- |
| 01 | Guarded wallet | Active design |
| 02 | Screening | Queued |
| 03 | Agent rails | Queued |
| 04 | Quantum-resistant signing | Queued |
| 05 | Credentials and sealed proofs | Queued |
| 06 | Builder kit | Queued |
| 07 | Shared watchlist | Queued |

## Stage 01: Guarded wallet

The foundation everything else plugs into.

- Owner-set ceilings, per day and per send
- Saved destinations and blocked destinations
- Rescue and recovery paths
- Expiring keys
- Emergency pause

**Exit criteria:** a testnet wallet that enforces the rules above, with written tests for every rule and an internal review.

## Stage 02: Screening

- Private request replays against a copy of chain state
- Allowance inspection
- Lookalike contract spotting
- Risk notes in plain words
- Score history per wallet

**Exit criteria:** replay results match actual execution on a recorded set of test transactions.

## Stage 03: Agent rails

- Per-agent limits and daily spend caps
- App and asset lists
- Keys that retire themselves

**Exit criteria:** an agent demo that completes a task inside its lane and is refused outside it.

## Stage 04: Quantum-resistant signing

- Registered backup keys
- Extra proof above an owner-set threshold
- Swappable signature schemes
- Rescue with the stronger key

**Exit criteria:** scheme chosen with a written cost analysis for Robinhood Chain, plus a swap drill.

## Stage 05: Credentials and sealed proofs

- Owner-held credentials and portable reputation
- One-fact disclosure
- ZK verification any app can run

**Exit criteria:** a working proof of a sample claim verified onchain without exposing source data.

## Stage 06: Builder kit

- Wallet libraries
- Agent toolkit
- Credential toolkit
- Owner console

## Stage 07: Shared watchlist

- Community-fed bad-contract list
- Automated sweeps for known flaws
- Live alerts to wallets

## Cross-cutting work

- Independent audits before any mainnet deployment of funds-holding contracts.
- Public documentation updated with every stage.
- Website records (`src/js/records.js`) updated the moment a contract, X account or repository is formally stated.

## How the roadmap changes

Changes land through pull requests that touch this file and explain why. Reordering needs a written reason.
