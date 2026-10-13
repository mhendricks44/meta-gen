# Meta-Gen — source

Full-stack app: React + Vite + Tailwind front end (`client/`), Express back end (`server/`), shared Drizzle schema (`shared/schema.ts`), SQLite database.

## Run locally

Requires Node 20+.

```
npm install
npm run db:push      # creates data.db from shared/schema.ts
npm run dev          # http://localhost:5000
```

On first start with an empty database, the server seeds 20 curated opportunities plus the "Founding peers wanted" post (`server/seed.ts`).

## Production

```
npm run build        # front end -> dist/public, server -> dist/index.cjs
npm start            # serves both on PORT (default 5000)
```

## Configuration

- `PORT` — default 5000
- `CURATOR_CODE` — code for the private curator console at `#/curate`. Default is `metagen-curator`; set your own before going live.

## Layout

- `client/src/pages/home.tsx` — the list, search, filters, in-place details
- `client/src/pages/share.tsx` — five-field share form
- `client/src/pages/curate.tsx` — curator review, reports, live items
- `client/src/components/` — shell (header/footer), join dialog, UI primitives
- `server/routes.ts` — API (opportunities, members, saves/tracks, reports, curator)
- `server/storage.ts` — database access
- `shared/schema.ts` — data model and validation

- `DATABASE_PATH` — SQLite file location (default `./data.db`). On a host, point this at a persistent volume, e.g. `/data/data.db`.
