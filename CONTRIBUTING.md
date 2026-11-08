# Contributing to Aprendify

Thank you for helping improve **Aprendify**, an ENEM preparation platform for Brazilian students. This guide explains how to propose changes, keep the architecture coherent, and protect student data.

---

## Golden rules

1. **Never weaken authorization to make a feature work.** User-owned data must stay protected by Row Level Security (RLS); privileged operations belong in Edge Functions.
2. **Never put secrets in the browser.** `VITE_*` variables are public. Service-role keys, Stripe secrets, Groq keys, and reCAPTCHA secrets stay in the Supabase Edge Function environment.
3. **Never edit an applied migration.** Add a new timestamped migration instead.
4. **User-facing copy is Brazilian Portuguese; repository artifacts are English.** Code comments may follow the surrounding file, but commits, documentation, and templates must be English.

---

## Prerequisites

- **Node.js 22 or newer** (validated with Node 24) and **npm 10+**.
- Git.
- A Supabase project for authentication and database work.
- Optional: Supabase CLI and Docker for local migrations/functions.
- Optional: Stripe test mode and a Groq API key for billing and AI flows.

## Local setup

```powershell
git clone https://github.com/felipevenas/aprendify.git
cd aprendify
npm install
Copy-Item .env.example .env.local
npm run dev
```

Fill `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The development server runs at **http://localhost:8080**.

For backend work, link a development/staging Supabase project and apply migrations:

```powershell
npx supabase link --project-ref <development-project-ref>
npx supabase db push
npx supabase functions deploy
```

Do not run these commands against production without an explicit maintainer decision.

---

## Workflow: trunk-based development

`main` is the stable branch. Create short-lived branches, keep them focused, and merge through a pull request after review.

```powershell
git checkout main
git pull origin main
git checkout -b <type>/<short-kebab-case-name>
```

### Branch names

Use English, lowercase, kebab-case descriptions:

| Prefix | Use |
|---|---|
| `feat/` | New user-facing capability |
| `bug/` | Bug fix |
| `chore/` | Build, tooling, dependencies, or configuration |
| `docs/` | Documentation or governance only |
| `style/` | Visual/CSS/formatting changes without behavior change |
| `refactor/` | Internal restructuring without behavior change |
| `test/` | Test-only changes |

Examples: `feat/essay-credit-balance`, `bug/fix-trial-return`, `docs/english-governance`.

Rebase on `main` while you work to keep history linear:

```powershell
git fetch origin
git rebase origin/main
```

---

## Commit conventions

Use **Conventional Commits in English**, with a short imperative subject (max 72 characters). Add a body when the change needs context.

| Prefix | Meaning | SemVer impact |
|---|---|---|
| `feat:` | New user-facing functionality | MINOR |
| `fix:` | Bug fix | PATCH |
| `chore:` | Build, tooling, dependencies, or configuration | — |
| `docs:` | Documentation only | — |
| `style:` | Formatting or visual-only change | — |
| `refactor:` | Internal restructuring | — |
| `test:` | Tests only | — |

Examples:

```text
feat: add essay credit balance to subscription settings
fix: preserve checkout return path after google sign-in
docs: standardize README and governance in English
```

---

## Architecture rules

### Feature-first frontend

- Put domain code under `src/features/<feature>/` with `pages`, `components`, `hooks`, `services`, and `types` as needed.
- `src/pages/*` are thin entry points used by lazy route loaders. Avoid adding business logic there.
- Shared, cross-feature UI belongs in `src/components/ui` or `src/shared`.
- Use the `@/`, `@features/`, and `@shared/` aliases configured in `tsconfig.app.json` and `vite.config.ts`.
- Do not import one feature's page from another feature. Extract shared logic into a hook, service, or `src/shared`.
- Keep route-level code splitting intact. New screens should be lazy-loaded through `src/lib/pageLoaders.ts` and `AppLayout`.

### Server state and forms

- Use **TanStack Query** for server state, caching, and invalidation. Do not duplicate server lists in local component state.
- Use **React Hook Form + Zod** for forms and mirror backend validation rules where the user needs immediate feedback.
- Supabase Realtime should invalidate/refetch affected queries, not become the only source of truth.
- Wrap privileged or multi-step operations in an Edge Function instead of weakening RLS.

### Supabase and database

- The typed client is `src/integrations/supabase/client.ts`; `src/integrations/supabase/types.ts` is generated. Regenerate it after schema changes.
- New user-facing tables require:
  - `ENABLE ROW LEVEL SECURITY`;
  - explicit `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies as appropriate;
  - indexes for policy and quota lookups;
  - a new timestamped migration under `supabase/migrations/`.
- Never edit or delete an applied migration. Use a forward migration with a rollback note when needed.
- Quotas and entitlements must be enforced in the database or an Edge Function, not only in React.
- Prefer `SECURITY DEFINER` RPCs for atomic, server-owned operations and keep `search_path` pinned.

### Edge Functions

- Put shared helpers in `supabase/functions/_shared/`.
- Authenticate requests with `authenticateRequest`, validate the JSON body with `readJsonObject`, and apply `consumeRateLimit` or `consumeAnonymousRateLimit`.
- Return the shared error shape (`error`, `code`) and `429` with `Retry-After` when a limit is hit.
- Never echo provider responses, secrets, stack traces, or personal data to the client.
- Keep `verify_jwt` settings in `supabase/config.toml` consistent with the function's own authentication logic.
- AI prompts must not include secrets, service-role keys, or unnecessary personal data.

---

## Quality gates

Run all gates before opening a pull request:

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm test
npm run build
```

| Gate | Command | Notes |
|---|---|---|
| Lint | `npm run lint` | ESLint 9 + typescript-eslint |
| Types | `npm run typecheck` | `tsc --noEmit`; not included in `npm run build` |
| Unit/domain tests | `npm run test:unit` | Node test runner with type stripping |
| Contract/static tests | `npm test` | Shared Edge Function tests + Deno global check |
| Production build | `npm run build` | Vite build into `dist/` |

There is no committed CI workflow. Do not assume a green remote check; run the commands locally and report the results in the pull request.

### When adding tests

- Add pure/domain tests next to the code as `*.test.ts` or `*.test.mjs`.
- Add Edge Function contract tests under `supabase/functions/_shared/*.test.mjs` when changing shared behavior.
- Update the `test:unit` script in `package.json` if you add a new test file that is not already covered by `npm test`.
- Do not weaken a gate to make a change pass.

---

## Security and privacy

- Never commit `.env`, real keys, tokens, cookies, user data, or production database dumps.
- `VITE_*` values are public. Never put `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `GROQ_API_KEY`, or `RECAPTCHA_SECRET_KEY` in a Vite variable.
- Do not log access tokens, refresh tokens, service-role keys, Stripe payload secrets, or full student records.
- Treat essay text, e-mail addresses, names, and social messages as personal data.
- Authorization must be enforced by RLS or Edge Functions. Hiding a button is not authorization.
- Report vulnerabilities privately according to [`SECURITY.md`](SECURITY.md); do not open a public issue with exploit details.

---

## Pull request process

1. Rebase on the latest `main`.
2. Open a pull request using [`.github/pull_request_template.md`](.github/pull_request_template.md).
3. Describe the problem, the solution, and the affected areas.
4. List the commands you ran and their results.
5. Add screenshots or recordings for UI changes, including mobile and both themes when relevant.
6. Update [`CHANGELOG.md`](CHANGELOG.md) for user-visible changes.
7. Request review and address feedback with new commits (do not force-push over an active review unless the maintainer asks).

### Definition of Done

- [ ] The change solves the stated problem and does not introduce unrelated refactors.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm test`, and `npm run build` pass.
- [ ] New behavior has tests, or the pull request explains why a test is not practical.
- [ ] Database changes use a new forward migration and include RLS/policy/index review.
- [ ] No secrets, `.env` files, personal data, or production credentials are included.
- [ ] UI changes were checked at mobile and desktop widths, in light and dark themes, with keyboard navigation.
- [ ] Documentation and `CHANGELOG.md` are updated when behavior or setup changes.
- [ ] The pull request description includes evidence and any known limitation.

---

## Questions

Use GitHub issues for reproducible bugs and scoped feature proposals. For security matters, follow [`SECURITY.md`](SECURITY.md) instead of opening a public issue.
