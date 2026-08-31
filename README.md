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

The interface has three color themes: Light, Blue, and Dark. The selector is in
the protected `/profile/settings` page. Interface language and preferred content
language are independent server-backed settings. The same page lets users choose
in-app and email notification delivery separately, control profile privacy and
who may comment on their videos, open the unchanged Craft Wallet, or end every
active authentication session after confirmation. Account deletion
requires the current password and is unavailable while the user owns projects;
owned projects must first be transferred or deleted. Successful deletion is
irreversible and signs the user out after the backend removes profile data and
anonymizes the core account; project activity history is retained.
Blue is the default. The selected theme value is stored as
`craft.theme` in the current browser and is applied before React renders, so it
survives reloads without requiring backend configuration. Theme choice is not
currently synchronized between browsers or devices.

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

## Reference Library

The visual-reference creation page at
`/project/:projectId/references/create` includes a generation-model selector in
the right-hand **Main** inspector. **Auto** follows the model configured for the
project or profile; choosing a model overrides it only for generations started
from the current page, including the cost estimate and queued job. Models whose
provider credentials are not configured remain visible but disabled. Editing
the reference and running generation require the existing project permissions.

## Script workspace

Open a project's **Script** section to write and organize screenplay scenes.
The collapsible left sidebar switches between the screenplay, structure, and character
relationships. In the screenplay editor, a separate collapsible panel on the right
lists the scenes and keeps explicit scene selection close to the editor. Each screenplay
scene remains a separate sheet; normal mouse-wheel scrolling does not switch scenes.
The workspace uses the shared application header. Save state, export, and return-to-project
controls live in the left sidebar and remain available as compact indicators and icon
buttons when that sidebar is collapsed.

The screenplay editor saves changes automatically after a short pause. Enter
creates the next screenplay paragraph, Shift+Enter inserts a line break, Tab
changes the paragraph format, and / opens contextual suggestions. In a
**Character** paragraph, typing filters the project's characters and selecting
one links that character to the scene. Backspace at the beginning of a
paragraph merges it back into the previous one; the active paragraph also has
an explicit delete action. The bottom zoom control scales only the screenplay
sheet from 50% to 200%, offers a fit-to-width mode, and remembers the user's
choice without changing the surrounding workspace UI.

The workspace also checks the saved screenplay for significant characters that
do not yet exist in Character Studio. A notice lists names with more than five
dialogue blocks, appearances in at least two scenes, or an existing draft
Character Studio record. Editors can open the character creation flow with the
selected name prefilled; the notice refreshes
after screenplay saves and disappears after a matching character is completed.
View-only collaborators see the missing names without creation controls.
The notice can be dismissed for the current list during the browser session;
it returns when screenplay analysis changes the missing names or their dialogue
or scene counts.

Video creation uses `/project/:projectId/video` as a live prerequisite gate.
Ready projects continue to `/video/generate`; blocked projects open the
dedicated `/video/preparation` checklist. The checklist groups missing
characters and empty scenes, and adds storyboard coverage while it is below
100%, with direct links back to character creation and the affected screenplay
scenes. A compact dashboard
status opens the same preparation flow before the user attempts generation.
The project statistics cards link directly to the character library, screenplay,
music library, and visual reference library for the current project.

The **Structure** view groups scene cards by act. Cards show the screenplay
heading, extracted location, linked characters, and a rough text-based duration
estimate; empty and locally unsaved scenes have explicit status labels. Editors
can drag scenes within or between acts, or use the keyboard-accessible movement
buttons. The backend applies the complete order atomically with optimistic
versions, so scene numbers stay unique. Double-clicking a card opens that scene
in the screenplay editor. Reordering is disabled while a character filter is
active, and the duration is only a writing estimate rather than production
timing.

The **Relationships** view derives objective character statistics from linked
screenplay dialogue. Node size represents dialogue count, while edge thickness
represents consecutive speaker changes inside scenes. Users can filter the
analysis to the whole screenplay, an act, or a scene; choose an exact number of
visible characters or show all; zoom the graph from 50% to 200% with the mouse
wheel; drag an enlarged graph to reach other nodes; collapse the details
sidebar from its edge; and inspect dialogue, word, shared-scene, and act
breakdowns. Keyboard users can zoom with plus/minus, pan with the arrow keys,
and reset with zero. Co-presence alone does not create a relationship, and
unlinked dialogue is reported separately instead of being guessed.

The screenplay keeps only a closed **Scene notes** panel for private technical
details that do not belong on the page. Act assignment lives in the Structure view;
manual duration and dramatic-function fields are not part of screenplay
editing. Detailed timing belongs to future shot planning. Character membership
is collected from character paragraphs rather than edited in a separate
participants field. Music actions, shot planning, and video-generation
segmentation are intentionally outside this workspace. Editing requires the
existing project edit permission.

## Storyboard workspace

Open a project's **Storyboard** step at `/project/:projectId/storyboard` to turn
screenplay scenes into an ordered shot list and direct each shot through visual
keyframes. Every shot starts with required **Start** and **End** keyframes;
editors can add intermediate keyframes, set semantic camera intent, adjust the
composition guides, and choose or override the camera movement between adjacent
keyframes. Continuity references can carry a character or location forward from
the preceding generated shot.

The workspace loads screenplay scenes and existing storyboard progress from the
project identified by the route. It no longer substitutes demo scenes from a
different project, and AI shot-list proposals use the selected project's scene
context. Editing automatically saves a permanent scene working draft on the
server, including shots, ordering, source links, camera settings, and the current
workflow stage. This does not create or update structured backend Shot/Keyframe
history or production-readiness metrics. Image generation, asset references, and preview
changes are still frontend-only prototype behavior and do not yet call a backend
provider. Camera controls deliberately describe
filmmaking intent (position, height, distance, framing, lens, composition, and
movement) without exposing XYZ coordinates, a 3D scene, or video generation.

The **Suggest shot list with AI** action first loads the server model allowlist,
scene context, model availability, and a best-effort USD estimate from
`GET /api/projects/{projectId}/storyboard/scenes/{sceneId}/suggest-shots/`.
The confirmation dialog lets the editor choose an available model before the
frontend posts that model, the shot limit, and the current UI language (`ru` or
`en`) to `POST .../scenes/{sceneId}/shot-list-jobs/`. Generated titles and descriptions follow that language;
original screenplay quotes remain unchanged. Existing English results are not
automatically translated or regenerated. Each logical text
model appears once: the backend selects its first available provider connection
in configured priority order. The dialog shows this provider and updates its
cost and token estimates when the model changes. The client submits the exact
connection ID it received, so the backend uses the same provider that was shown
for confirmation; a failed request does not automatically switch providers.
Models and provider credentials are configured on the backend, with no frontend
model list to maintain. The backend asks
the selected allowlisted text model for structured JSON, validates every
referenced project entity, and saves the result on the server. The cost is an
informational provider estimate, not a reservation or final charge. The
worker saves an editable scene draft and the frontend displays it for review.

The initial click immediately shows a "Loading models…" indicator in the center
of the screenplay block. It disappears when the model dialog opens. After
confirmation, the same area shows "Creating shots…" until generation finishes.
The dialog shows an approximate duration; during generation, estimated remaining
time appears below the spinner. The first estimate is a
heuristic based on output-token budget, then adjusts using the last five
successful durations for that model in this browser. It is not a provider SLA or
real completion percentage. When the estimate runs out, the UI explains that
the response is taking longer; it never claims
the operation finished. Timing history contains only durations and token counts.
The action button stays disabled without its own spinner throughout the flow.
Loading and errors belong to the originating scene; navigating to another scene
does not redirect a completed proposal into it. Timeout, rate-limit, provider
rejection, and invalid-response errors have distinct messages.

The proposed shot list shows each shot's number, title, and a two-line description
preview. **Expand** opens the full title and multiline description for editing
inside that row; only one row is expanded at a time. Hovering over a preview
also shows the full description. Reorder shots using the dedicated drag handle
or the menu's **Move up / Move down** actions. Content and order changes save
automatically; simply expanding a row does not create another record.

The header's back arrow returns from directing to the shot list without resetting
shots, source links, or camera settings. From manual markup it returns to the
existing shot list (or the screenplay when no shots exist); from the shot list or
screenplay it returns to scene selection. Only the initial scene-selection screen
links back to the project. The directing/shot-list stage continues to autosave.
Regular buttons in the workspace inherit the shared secondary action style via
the `craft-secondary-actions` container; primary, text, link, and destructive
buttons keep their distinct styling.

**Back to source** in the shot-list header resets the selected scene after
confirmation. It clears draft shots, markup, camera settings, and any locally
recovered AI proposal, keeping the screenplay and other scenes unchanged. The
empty draft is saved through the existing revision-checked API and reopens the
original AI/manual choice after navigation or reload. It does not delete
structured Shot/Keyframe history or media assets. Cancel leaves the draft intact.
An AI response started before the reset cannot automatically put the old shots
back; if it arrives later, it is retained separately for an explicit choice.

Inside an expanded shot, **Show in screenplay** opens the full scene in a
drawer, highlights every passage linked to the shot, and scrolls to the first.
When the saved text matches the screenplay blocks, the drawer retains the
screenplay font and paragraph layout for characters, dialogue, remarks, and
actions. Historical snapshots that no longer match those blocks remain verbatim;
formatting never substitutes current dialogue or shifts source highlights.
Multiple shots may share a passage. New AI proposals return server-owned source
segments and selected IDs; the UI never guesses original quotes from the AI's
description. If the screenplay version changed, the drawer shows the preserved
generation snapshot with a warning. A warning also identifies long scenes for
which only the first 20,000 characters were sent to the model. Existing drafts
without source links still show the full current scene, without highlights.

**Create shot manually** opens interactive screenplay markup. Select text with
the mouse or keyboard (or use **Select all text**), choose **Create shot from
selection**, and edit the title and description in the small form underneath.
Adding the shot saves its exact Unicode range and source snapshot. Overlapping
selections and multiple shots for the same text are allowed. Coverage counts each
non-whitespace character once; after 100% coverage, **Review shot list** becomes
available. It does not force navigation, allowing extra reaction shots. Added
shots and partial coverage survive navigation; an unconfirmed text selection or
unfinished form is not a shot and is not saved. Web Crypto requires HTTPS or
localhost for recording source hashes.

The permanent draft API uses `GET .../storyboard/editor-drafts/` and
`PUT .../storyboard/scenes/{sceneId}/editor-draft/`. Project viewers can read and
editors can write. Save status reflects the server acknowledgement, not a timer.
Queued writes continue when navigating within the app, with revision checks and
idempotent retry. A conflict never silently overwrites either version: the editor
can explicitly choose the saved server version or their local version. An AI
response arriving after local edits is retained separately with an explicit
replacement action. No extra AI call is made when restoring a scene.

Pending writes also have an account/project-scoped browser recovery copy. A
failed save is visible with retry; closing the tab with unsaved changes triggers
the browser warning. Saving stops if authentication changes, so old writes cannot
use another account's credentials. The former temporary-draft controls are
removed. A legacy browser copy is transferred when no server draft exists and
removed only after server acknowledgement (an existing server draft takes
priority). Signed media URLs, binary images, and credentials are never included.
Opening the workspace once completes this migration in the user's browser.
Already-lost results cannot be recovered. New AI shot lists are durable server
jobs: navigation, reload, or closing the tab does not cancel an accepted job.
The existing `storyboard` generation worker must be running against the same
database as the web server. `GET .../shot-list-jobs/` restores the latest job per
scene and the original timer; active jobs are polled every two seconds. A failed
status check does not cancel the job or automatically start a replacement.
Request IDs and a single active job per scene prevent duplicate paid launches.

The worker always retains a successful result. It adopts the result as a draft
only if the draft revision and screenplay snapshot have not changed and the
initiator still has edit permission. Otherwise a saved proposal offers explicit
**Apply proposal** (replace current shots) or **Keep current shots**; these choices
are revision checked and require edit permission. The page waits for pending
draft saves before launching/applying and preserves local conflicts when it
refreshes server data. Provider errors are saved and shown after returning.
Generation success itself is not guaranteed: provider errors or a crashed worker
after an uncertain paid call require an explicit retry, never an automatic second
charge. A queued job waits for a worker to become available.

### Storyboard follow-up tasks

- [ ] Publish working drafts through the structured Storyboard API:
  initialize the scene storyboard when necessary, create the shot with
  `POST /api/projects/{projectId}/storyboard/{storyboardId}/shots/`, replace the
  working draft with the server response and update production-readiness metrics.

## Contract changes

The backend contract is canonical. When it changes, synchronize
`openapi/w_craft.openapi.json`, run `npm run api:generate`, and commit the
generated `contracts.ts`/`client.ts` together with affected consumers. Verify
with `npm run api:check` and `npm run contract:test`.
