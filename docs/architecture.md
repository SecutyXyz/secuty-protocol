# Architecture

Target design for Secuty on Robinhood Chain. Stage 01 is in design; the rest is intended shape.

## Component view

```
                 Credentials  (owner-held, sealed)
                      |
Owner / Agent --> Secuty Wallet --> Robinhood Chain
                      ^   |
                      |   +--> Quantum-resistant signature (large moves)
                      |
          +-----------+-----------+
          |                       |
      Screening              Sealed proofs
   (advice, not power)     (ZK verification)
```

## Components

### Secuty Wallet (onchain)
Holds funds and the rulebook. Exposes one entry point for execution. Stores:

- **Holders:** owner keys and recovery keys.
- **Actors:** agent keys, each with permissions, app list, asset list, daily cap and expiry.
- **Rules:** ceilings, saved destinations, blocked destinations, escalation threshold.
- **Pause flag.**

Execution succeeds only if the rulebook returns *allow* for the (actor, target, asset, amount) tuple. The wallet never reads a model's output as authority.

### Screening (offchain, advisory)
Takes an intent, replays it against a copy of chain state and returns:

- net asset movements per token,
- allowances that would be granted,
- onward calls the target would make,
- a short plain-language note and a risk level.

The risk level can be wired into a rule as an *input* ("escalate if risk is high") but the rule remains deterministic.

### Agent rails
A permission profile attached to an agent key. The wallet checks the profile before calling out. Raising a cap or adding an app requires an owner signature, never the agent's.

### Signature layer
A pluggable verifier. The wallet stores the active scheme identifier and registered backup keys. Above the owner's threshold, execution needs both the normal signature and one from the stronger scheme. Replacing the scheme is an owner operation that does not move funds.

### Credentials and sealed proofs
Credentials are issued to and held by the owner. A verifier contract checks a zero-knowledge proof of a statement ("holder is eligible") and returns a boolean to the calling app. Source data never touches the chain. This layer secures credentials; it does not make ordinary transfers private.

### Shared watchlist
An append-only feed of reported contracts and patterns with attribution. Screening consumes it; wallets can subscribe to alerts.

## Data flow for one request

1. Intent created by owner or agent.
2. Screening replay returns effects and a note.
3. Wallet loads rulebook and actor profile.
4. Rulebook evaluates: **allow**, **deny** or **escalate**.
5. On escalate, the wallet waits for the stronger signature.
6. On allow, the call executes and an event is emitted for indexers.

## Trust boundaries

| Boundary | Trusted for | Not trusted for |
| --- | --- | --- |
| Wallet contract | Enforcing rules | Judging intent |
| Screening service | Surfacing facts | Authorizing anything |
| Agent | Doing work inside its lane | Changing its lane |
| Watchlist | Hints | Final verdicts |

## Website

The public site is a static bundle (`src/`). It reads the chain RPC, DefiLlama and DexScreener from the browser, has no backend, and never asks for a wallet connection. External facts (contract address, social links) live in `src/js/records.js`; external URLs pass an allow-list before use.
