# Secuty

**Secure the autonomous future.** Secuty is a wallet-protection protocol designed for [Robinhood Chain](https://rpc.mainnet.chain.robinhood.com) (chain ID 4663). It combines programmable accounts, sealed credentials, adaptive risk screening and quantum-resistant signing, so people and AI agents can move value under rules the owner wrote.

Website: <https://secuty.xyz>

> **Status: design stage.** The protocol is not deployed. No contract address, token or audit exists yet. This repository holds the public site and the design documents. Anything claiming otherwise is not from this project.

## What it is for

Machines now act on stated goals faster than a person can read a prompt. Secuty puts a fixed rulebook between an intention and the chain:

1. **Declare.** An owner, or an agent holding a narrow key, states what it wants.
2. **Screen.** The request is replayed privately and read for risk.
3. **Authorize.** Owner-written limits answer yes, no, or "show stronger proof".
4. **Sign.** Cleared requests are signed. Large ones need a quantum-resistant signature.

Models flag. Rules decide. Owners hold the keys.

## Modules

| Module | Job | Stage |
| --- | --- | --- |
| Wallet | Holders, limits, recovery, emergency pause | 01, active design |
| Screening | Replays and risk notes in plain words | 02 |
| Agent rails | One narrow, expiring key per AI agent | 03 |
| Future-proof signing | Swappable quantum-resistant schemes | 04 |
| Credentials and sealed proofs | Owner-held identity, ZK verification | 05 |
| Builder kit | Libraries, agent toolkit, owner console | 06 |
| Shared watchlist | Community-fed bad-contract data | 07 |

Details live in [`docs/`](docs): [whitepaper](docs/whitepaper.md), [architecture](docs/architecture.md), [roadmap](docs/roadmap.md), [tokenomics](docs/tokenomics.md).

## The site

A dependency-free static site with live chain data (node RPC, DefiLlama, DexScreener).

```bash
npm run build   # copies src/ to dist/
npm run gates   # 30 checks, headless Edge or Chrome required, ~1-2 minutes
```

Open `dist/index.html` through any static server.

### Layout

```
src/            site source (HTML, CSS, ES modules, assets)
  js/records.js every external fact, one record each
  styles/tokens.css  the only file allowed to contain colour literals
brand/          supplied logo files and brand/make-assets.mjs
reference/      supplied slide deck images
gates/          the check runner and its synthetic fixtures
scripts/        build script
docs/           design documents
```

### House rules

- **Records.** Contract address, X and GitHub live in `src/js/records.js` as `stated`, `absent` or `unconfirmed`. Nothing links to an unstated record; the contract slot stays inert until an address is stated.
- **Colour.** Palette values are sampled from the brand files and documented in `tokens.css`. No colour literal may appear elsewhere.
- **Motion.** Everything degrades to instant under `prefers-reduced-motion`.
- **Accessibility.** Tap targets are at least 48 px at 360, 390, 430, 1366 and 1440 px, with no horizontal overflow.

Regenerate the favicon and logo PNGs after a brand change with `node brand/make-assets.mjs`.

## Contributing and security

Read [CONTRIBUTING](.github/CONTRIBUTING.md) before opening a change and [SECURITY](.github/SECURITY.md) before reporting a weakness.

## License

[MIT](LICENSE). Brand files in `brand/` and `reference/` are not covered by it.
