# Contributing

Thanks for your interest in Ask the Creator!

## Dev setup

```bash
npm install
cp .env.example .env.local   # or use the in-app setup wizard
npm run dev
```

By default the app uses a local SQLite database (`data/`), so you don't need Postgres to develop.

## Before opening a PR

- `npm run build` and `npx tsc --noEmit` both pass
- Keep changes focused; describe what and why in the PR description
- Don't commit secrets — keys live in `.env.local` or `data/config.json` (both git-ignored)

## Architecture notes

- `src/lib/store/` — pluggable storage backends (`sqlite` default, `pgvector`, `memory`) behind the `store.ts` facade. Add a method to `StoreBackend` and implement it in all three.
- `src/lib/transcript.ts` — transcript fetching (Supadata).
- `src/app/api/chat/route.ts` — answer routing (LLM-only vs RAG by token threshold).

## Good first issues

Look for the `good first issue` label. Ideas: a multi-creator "panel" answer mode, additional embedding/model providers (e.g. local models via Ollama), or an admin view for stored channels.
