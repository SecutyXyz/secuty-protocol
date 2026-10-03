# Security Policy

## Scope

Secuty is in design stage. There is **no deployed contract and no production service**. Today the in-scope surface is:

- the website source in this repository (`src/`),
- the design documents in `docs/`,
- the gate runner in `gates/`.

Once contracts exist, this file will list their addresses and add them to scope.

## Reporting a vulnerability

Please report privately and do not open a public issue.

1. Use the repository's **private vulnerability reporting** (Security tab, "Report a vulnerability") once the repository is public and the feature is enabled.
2. A dedicated security mailbox has **not been published yet**. It will be added here the moment it exists. Do not send reports to addresses found on third-party pages that claim to be Secuty.

Include:

- what you found and where,
- steps to reproduce,
- the impact you believe it has,
- any suggested fix.

## What to expect

- Acknowledgement of your report as soon as a maintainer sees it.
- A good-faith assessment and a plan, shared with you.
- Credit in the fix notes if you want it.

No response-time or bounty promise is made while the project has no funded security programme.

## Good-faith research

We will not pursue anyone who:

- tests only against their own accounts or local builds,
- avoids accessing or destroying other people's data,
- gives us reasonable time to fix before disclosing,
- does not degrade third-party services (the site reads public APIs; please do not hammer them).

## Out of scope

- Findings that require a compromised user device.
- Social-engineering or phishing of maintainers.
- Missing security headers on a local build; deployment headers are set by the host.
- Reports about tokens, sales or accounts impersonating Secuty. Report those to the platform concerned, and let us know.

## Scam awareness

The official contract address, X account and repository are announced only through the website's top bar and the project records. Until the contract slot shows an address, no Secuty token exists.
