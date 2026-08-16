# who_craft — Craft web client

React 18 + TypeScript single-page application for Craft, built with Create React
App 5. It consumes the sibling Django backend and contains project/team, poster,
script, Character Studio, Music Studio, Reference Library, profile, and social
subscription experiences.

The protected `/credits` route is the Craft wallet. It shows available and
reserved credits, 30-day movement statistics, and the append-only operation
history. In demo environments it can add test credits; staff can transfer
available credits between user wallets through the administration controls. Project
owners can set a lifetime generation budget and see spent, reserved, and
remaining credits. The client never connects to a bank or provider balance
directly.

Paid generation screens request a backend estimate before enqueue. They block
when the available balance is insufficient and otherwise show a confirmation
with the provider-native estimated cost. The backend remains authoritative: it
reserves at enqueue, settles after provider completion, and refreshes the
visible balance when the request starts.

The wallet also stores the user's generation-routing preference (manual,
lower-cost, faster, balanced, or quality), shows low-balance/frozen warnings,
generation spending by project and type, and provider-billed totals in job
history. Staff users can freeze or unfreeze their own wallet without entering a
login and can perform an audited transfer by specifying sender, recipient,
amount, and reason. Adjustment and manual-refund controls are not exposed.
Automatic generation always confirms its maximum primary-plus-fallback
reservation before enqueue.

System-wide documentation is in the parent workspace:
`../README.md`, `../AGENTS.md`, and `../docs/`.

## Setup

Recommended local runtime: Node.js 20 and a backend at
`http://localhost:8000`.

```bash
cp .env.example .env
npm install
npm start
```

`REACT_APP_BACKEND_URL` is the only frontend environment variable. The example
points to the local backend.

## Commands

```bash
npm start                                  # development server
npm run lint                               # ESLint; no-console is an error
npx tsc --noEmit --pretty false            # type check
npm test -- --watchAll=false --runInBand   # Jest/RTL suite
npm run build                              # production bundle in build/
npm run api:check                          # generated API drift check
npm run contract:test                      # focused API contract regressions
npm run api:generate                       # regenerate checked-in API client
```

The GitHub Actions workflow runs `api:check`, TypeScript, and
`contract:test`; it is a focused contract gate, not the complete lint/test/build
suite.

Every new user-visible feature must include a short reference in the same
change: what it does, where the user opens it, its main flow, required backend
configuration or permissions, and known limitations. Prefer updating the
relevant parent-level `../docs/` page over creating duplicate documentation.
Purely visual styling, layout, animation, and polish do not require documentation
when behavior, permissions, APIs, configuration, and data are unchanged.

## Architecture map

- Entry/router: `src/index.tsx`, `src/App.tsx`, `src/routes/pathConstant.ts`.
- Shared HTTP/auth: `src/api/http.ts`.
- Generated API surface: `openapi/w_craft.openapi.json` ->
  `src/api/generated/`.
- Feature modules: `src/modules/character-studio/`, `music-studio/`,
  `reference-library/`, `credits/`, `profile/`, and `subscriptions/`.
- Project, poster, dashboard, and script pages: `src/page/`.
- Localization: `src/i18n/` and locale resources.

State is composed from React hooks, context, and feature hooks; there is no
Redux/Zustand store.

## Auth and media

The shared Axios client stores distinct opaque access/refresh tokens in local or
session storage, injects the access token as `X-User-Token`, coordinates a
single refresh rotation after a 401, retries once, and emits an auth-expired
event when recovery fails. Never add tokens to URLs or request logging.
Only `authToken` and `authRefreshToken` are recognized storage keys. Retired
credential keys are purged without authenticating the user, who must sign in
again.

Use `backendAssetUrl()` or URLs returned by the API for media. Private media is
served by the backend through signed URLs; frontend code must not construct
direct `MEDIA_ROOT` paths.

## 3D editor

Character Studio uses React Three Fiber/Three.js around an SMPL morph rig. It
supports parametric zones, canonical views, snapshot/GLB export, autofit state,
and optional reconstructed head/hair assets. The heavy Hunyuan runtime belongs
to the backend worker's separate Python/Conda environment.

## Contract changes

The backend contract is canonical. When it changes, synchronize
`openapi/w_craft.openapi.json`, run `npm run api:generate`, and commit the
generated `contracts.ts`/`client.ts` together with affected consumers. Verify
with `npm run api:check` and `npm run contract:test`.
