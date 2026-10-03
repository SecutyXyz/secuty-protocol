# Contributing to Secuty

Thanks for helping. The project is in design stage, so the most useful contributions are careful ones: sharper threat models, clearer docs, and a site that stays fast and accessible.

## Ground rules

- Be specific. Say what you changed and why.
- Keep changes small enough to review in one sitting.
- Do not add dependencies without a written reason. The site is intentionally dependency-free.
- Be kind. Disagree with ideas, not people.

## Getting set up

```bash
npm run build
npm run gates
```

Gates need Microsoft Edge or Google Chrome installed. They use synthetic data only and never hit live services.

## What a good change looks like

1. **One purpose per pull request.**
2. **Gates stay green.** If you must change a gate, explain the new behaviour in the description.
3. **Docs move with code.** Behaviour changes touch `docs/` in the same pull request.
4. **No stray facts.** Contract addresses, social accounts and repositories live in `src/js/records.js` only. Do not hard-code them elsewhere, and do not mark one `stated` unless the project has formally announced it.
5. **Colour literals only in `src/styles/tokens.css`**, each with a provenance comment.
6. **Motion has a reduced-motion fallback.**
7. **Touch targets are 48 px or larger**, and nothing overflows at 360 px wide.

## Writing style

Plain words, short sentences, no hype. Never promise returns or dates. Original text only; do not paste from other projects' sites or documents.

## Proposing protocol changes

Open an issue first with:

- the problem,
- the smallest change that solves it,
- what it does to the threat model in [`docs/whitepaper.md`](../docs/whitepaper.md).

Changes that let a model, agent or service move funds without an owner-written rule will not be accepted.

## Reporting security issues

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## License

By contributing you agree that your contribution is released under the project's [MIT license](../LICENSE).
