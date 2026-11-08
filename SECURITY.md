# Security Policy — Aprendify

Aprendify handles student accounts, study history, essay content, social messages, subscription data, and payment flows. We take security and privacy seriously and welcome responsible disclosure.

---

## Supported versions

Only the current production build served at [app.aprendify.cloud](https://app.aprendify.cloud) and the `main` branch of this repository receive security updates.

| Version | Supported |
|---|---|
| Current production build (`main` / `app.aprendify.cloud`) | ✅ Yes |
| Older snapshots, forks, and unmaintained deployments | ❌ No |

---

## Reporting a vulnerability

**Do not open a public GitHub issue for a security vulnerability.**

Use GitHub's private vulnerability reporting:

**[Open a private security advisory](https://github.com/felipevenas/aprendify/security/advisories/new)**

Include as much of the following as possible:

- A clear description of the issue and the affected feature or file.
- Exact reproduction steps and a proof of concept.
- The potential impact (data exposure, privilege escalation, account takeover, payment manipulation, denial of service, etc.).
- The affected environment (production, local, or a specific commit).
- Screenshots, logs, or request/response samples with **tokens, personal data, and secrets redacted**.
- Whether the issue has been shared with anyone else.

Please do not include real student data, production credentials, or other people's personal information in the report.

### What to expect

| Stage | Target |
|---|---|
| Initial acknowledgement | Within **48 hours** |
| Triage and severity assessment | Within **5 business days** |
| Fix or mitigation plan | Based on severity and reproducibility |
| Coordinated disclosure | After a fix is deployed, with credit only if you agree |

The maintainer may ask for clarification or a safer reproduction environment. Please keep the report private until a fix is available.

---

## Scope

### In scope

- **Authentication and session security** — Supabase Auth flows, `auth-login`, Google OAuth, password recovery, e-mail confirmation, TOTP MFA, redirect handling, and session isolation.
- **Authorization and RLS** — missing or overly broad Row Level Security policies, cross-account reads/writes, privilege escalation, admin-role bypass, and service-role exposure.
- **Edge Function security** — missing authentication, missing admin checks, rate-limit bypass, request-body validation gaps, secret leakage, unsafe CORS, and error responses that expose internals.
- **Payment and entitlement integrity** — Stripe webhook signature verification, event replay/idempotency, price tampering, coupon abuse, trial eligibility bypass, and Premium gating enforced only on the client.
- **Quota enforcement** — bypassing the free daily question cap, monthly essay quota, flashcard cap, or Premium-only mock exams.
- **Data protection** — exposure of essay content, messages, e-mail addresses, presence, subscription data, or creator/coupon data to unauthorized users.
- **Injection and content handling** — XSS, unsafe HTML rendering, SQL/RPC injection, prompt-injection paths that cross an authorization boundary, and unsafe file/URL handling.
- **Client-side security** — secrets in `VITE_*` variables, tokens in logs, open redirects, and unsafe `postMessage`/navigation handling.

### Out of scope

- Vulnerabilities that require a compromised device, browser extension, or stolen credentials.
- Missing security headers on non-production deployments.
- Reports based only on automated scanner output without a reproducible impact.
- Social engineering, spam, or physical access.
- Denial-of-service claims that rely on unrealistic traffic volumes.
- Issues in third-party services (Supabase, Stripe, Groq, Google, Vercel) that should be reported to those providers.
- Dependency-version findings without a demonstrated exploitable path.

---

## Security assumptions

- The browser receives only the Supabase publishable/anon key and public configuration in `VITE_*`.
- The service-role key, Stripe secrets, Groq key, and reCAPTCHA secret exist only in the Edge Function environment.
- RLS is the authorization boundary for user-owned rows; Edge Functions enforce authentication, admin roles, quotas, and rate limits for privileged operations.
- Stripe webhooks are authenticated with `STRIPE_WEBHOOK_SECRET` and processed idempotently through `stripe_webhook_events`.
- The product UI is pt-BR, but security reports and coordination are handled in English or Portuguese.

---

## Resolution process

1. **Triage** — validate the report privately and assign a severity.
2. **Mitigation** — prepare a fix in a private branch or local environment.
3. **Verification** — test the fix against the reproduction and check adjacent flows.
4. **Deployment** — release the fix to production and, when appropriate, the `main` branch.
5. **Disclosure** — publish a coordinated note or changelog entry after users are protected. Credit is given only with the reporter's consent.

We may close a report as informational if it does not demonstrate a security boundary violation, but we will explain the reasoning.

---

## Safe harbor

We will not pursue legal action for good-faith security research that:

- stays within the scope above;
- avoids privacy violations, data destruction, and service disruption;
- uses test accounts and redacted data;
- gives us reasonable time to fix the issue before public disclosure.

This safe harbor does not authorize access to data you do not own or permission to test third-party services outside their own policies.

---

## Thanks

Responsible reports help protect students and their data. Thank you for taking the time to investigate and report issues privately.
