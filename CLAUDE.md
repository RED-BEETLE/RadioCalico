# RadioCalico

## Development server

Default webserver for local development and testing is `server.js` (Express + SQLite).

Start it with:
```
npm start
```

Runs at http://localhost:3000

## Stack

- Server: Express.js (`server.js`)
- Database: SQLite (`data.db`, auto-created on first run)
- Frontend: static HTML + Fetch API (`public/index.html`)

## API

- `GET /api/items` — list all items
- `POST /api/items` — create item (`name` required, `description` optional)
- `DELETE /api/items/:id` — delete item
- `GET /api/ratings?artist=&title=&client_id=` — get thumbs-up/down counts for a track, plus `voted` (`"up"`, `"down"`, or `null`) for that `client_id` if given
- `POST /api/ratings` — body `{ artist, title, rating, client_id }` (`rating` is `"up"` or `"down"`); upserts counts and records the vote. Returns `409` if `client_id` already voted on that track.

Items table columns: `id`, `name`, `description`, `created_at`.

Ratings table columns: `id`, `artist`, `title`, `thumbs_up`, `thumbs_down`, `created_at` (unique on `artist` + `title`, since the stream has no stable track ID).

Rating_votes table columns: `id`, `client_id`, `artist`, `title`, `rating`, `created_at` (unique on `client_id` + `artist` + `title`) — enforces one vote per track per client, server-side.

`public/radio.html`:
- Generates a random `client_id` on first load (stored in `localStorage`) and sends it with every rating request; the server rejects a second vote from the same id on the same track, and the buttons are disabled client-side once a vote is recorded (persists across reloads).
- Shows elapsed time on the current track, tracked client-side starting at 0 and reset whenever `metadata.json` polling detects a track change. The HLS stream is live, so `audio.currentTime`/`duration` are live-buffer positions (not song-relative) and the stream exposes no song length — there is no "total length" to show.

Please change the new tags to display each prisavtalstyp by its Prisavtalstyp.Kod so for example, TI, FA or GA.

I want to give each type a uniqe colour, can you take a look in the workspace to see what colours are already used to get an understanding of what colours to choose.

When a new TimIndex row is created I want the previos active TI to be made unactive as only one TI can be active at a time, is this implemented?

Lets create a cleanup plan. Go through all changes (you can divide the codebase up if that is more efficient) made on this branch and see what can be removed/simpified/combined/broken appart to remove any unneccesary code whilst keeping it redable and structured.

Is there a way of finding temporary/troubleshooting tables crated in the database? After a large new feature I want to check if there are remaining database changes that needs to be removed

Behövs testas:
Databasen! Migreringar behövs verifieras och specialcases behövs gås igenom för att se om det är accepterade.
När känner vi oss redo för att ta bort de gamla PA värdena/tabellerna?

Guit, ser allt okej ut? Fungerar det som förväntat? Saknas något?

Logiken, om en ny TI skapas, avaktiveras den föregående aktiva?
om ett nytt avtal skapas, fungerar TI som det ska?
Går det att kopiera ett TI för att skapa ett nytt?
Saknas/bör det tas bort någon logik kopplad till när ett TI får sparas? Tomma priser? Tider?

Hjälpdokument inför möte med inköpare

## Testing

Run `npm test` (Vitest). Also `npm run test:server`, `npm run test:client`, `npm run test:watch`, `npm run test:coverage`.

- Backend (`test/server`): supertest against `createApp(":memory:")` exported from `server.js`. `server.js` only listens when run directly; `DB_PATH` and `PORT` env vars override the defaults.
- Frontend (`test/client`): jsdom. `test/helpers/loadScripts.js` loads a `public/*.html` page and runs its `public/js` classic scripts in order, so tests call their globals via `page.run("...")` with `fetch` mocked. HLS/audio code (`initializeStream`, stall watchdog) is not covered.
- Needs Node 22+. jsdom is pinned to v24 because newer versions require Node 22.12+.
- Frontend coverage reports 0% because scripts run via `vm` in jsdom, which the coverage tool cannot see; backend coverage is real. Don't add a coverage threshold until this is fixed.

## CI / GitHub Actions

- `.github/workflows/ci.yml` (push to `master`, all PRs): unit tests with coverage (uploaded as an artifact), `npm audit` (fails on high/critical in production deps; dev deps report only), dependency review (PRs only), and a gitleaks secret scan.
- `.github/workflows/codeql.yml` (push to `master`, PRs, weekly Monday): CodeQL static analysis with `security-extended` queries.
- `.github/workflows/claude.yml`: runs Claude Code when `@claude` is mentioned in issues/PRs. Uses the `ANTHROPIC_API_KEY` repository secret as `ANTHROPIC_AUTH_TOKEN` and the `ANTHROPIC_BASE_URL` repository variable (gateway endpoint). Never commit keys or the gateway URL.
