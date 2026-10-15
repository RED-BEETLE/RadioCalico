# RadioCalico

A web radio player with live track metadata and per-track thumbs up/down ratings, built with Express and SQLite.

## Getting started

Requires Node 22+.

```
npm install
npm start
```

The server runs at http://localhost:3000. The SQLite database (`data.db`) is created on first run.

- `/radio.html` – radio player (HLS stream, track info, ratings)
- `/` – simple items CRUD page

Environment variables: `PORT` (default `3000`) and `DB_PATH` (default `./data.db`).

## API

- `GET /api/items`, `POST /api/items`, `DELETE /api/items/:id`
- `GET /api/ratings?artist=&title=&client_id=` – thumbs counts for a track, plus `voted` for that client
- `POST /api/ratings` – body `{ artist, title, rating, client_id }`; `409` if the client already voted on the track

See `CLAUDE.md` for table details.

## Project layout

```
server.js            Express app (exports createApp, listens only when run directly)
public/              Static frontend (HTML, CSS, public/js)
test/server/         API tests (supertest, in-memory SQLite)
test/client/         Frontend tests (jsdom)
test/helpers/        Loads public/js scripts into jsdom
.github/workflows/   CI, CodeQL and Claude Code workflows
```

## Testing

```
npm test                # all tests
npm run test:server     # backend only
npm run test:client     # frontend only
npm run test:watch      # watch mode
npm run test:coverage   # with coverage report
```

Frontend coverage currently shows 0% (a tooling limitation); the tests do exercise the code. HLS/audio playback code is not covered.

## CI and security

On pushes to `master` and on pull requests, GitHub Actions runs:

- Unit tests with coverage
- `npm audit` (fails on high/critical issues in production dependencies)
- Dependency review (PRs)
- Secret scanning with gitleaks
- CodeQL static analysis (also weekly)

Mention `@claude` in an issue or PR comment to run Claude Code. It needs the `ANTHROPIC_API_KEY` secret and `ANTHROPIC_BASE_URL` variable set in the repository settings.
