# who_craft — Craft web client

React 18 + TypeScript single-page app (bootstrapped with Create React App) for the
Craft platform. It talks to the Django backend in the sibling `backend/`
repository.

> This is one of two git repositories in the Craft working tree. System-wide
> documentation lives at the parent level: `../README.md`, `../CLAUDE.md`, and
> `../docs/` (see `../docs/architecture.md` §10 for the frontend overview).

## Setup

Requires Node.js and a running backend.

```bash
cp .env.example .env     # REACT_APP_BACKEND_URL=http://localhost:8000/
npm install
npm start                # dev server → http://localhost:3000
```

## Scripts

- `npm start` — run the dev server.
- `npm test` — Jest + React Testing Library.
- `npm run lint` — ESLint. **`no-console` is an error**; remove stray `console.*`
  before committing or lint fails.
- `npm run build` — production static bundle into `build/`.

## Key facts

- **Backend URL** comes from `REACT_APP_BACKEND_URL` (`src/api/http.ts`).
- **Auth:** a UUID token is stored in `localStorage` (`authToken`) and sent on
  every request as the `X-User-Token` header.
- **State:** React hooks + context (no Redux/Zustand).
- **3D character editor:** a parametric humanoid rig on plain three.js under
  `src/modules/character-studio/components/character3d/` (see
  `../docs/architecture.md` §10).

See `../CLAUDE.md` for agent working rules (lint/test expectations, constraints).
