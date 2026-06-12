# ask-the-creator

Chat with any YouTuber, grounded in their own video transcripts (RAG).

Flow: **search a channel → pick filters (Shorts/videos, count, order) → "Embetten" → RAG chat** with answers in the creator's style and clickable video+timestamp sources.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- YouTube Data API v3 (channel search, video listing)
- **Supadata API** (YouTube transcripts, bypasses IP blocks)
- OpenAI embeddings + chat
- **Postgres + pgvector** (persistent embeddings across serverless instances)
- **Password gate** (optional, via `SITE_PASSWORD`)

## Mock mode

Without API keys the app still runs end-to-end with **mock channels, transcripts and embeddings**, so the full UI/flow works for development and demos. Set the keys for the real thing.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in keys
npm run dev
```

### Required env

| Var | What | Where |
| --- | --- | --- |
| `OPENAI_API_KEY` | embeddings + chat | https://platform.openai.com/api-keys |
| `SUPADATA_API_KEY` | YouTube transcripts (bypasses IP blocks) | https://supadata.ai |
| `DATABASE_URL` | **Postgres with pgvector** (required for persistence) | See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) |
| `YOUTUBE_API_KEY` | (optional) channel/video search | Google Cloud Console → enable "YouTube Data API v3" |
| `SITE_PASSWORD` | (optional) password-protect entire app | any string |

**⚠️ Without `DATABASE_URL`:** Embeddings are stored in-memory and **lost between serverless instances** (Vercel). You'll see "channel not embedded" errors. Follow [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) to fix this.

### Database Setup

See **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** for step-by-step Supabase + pgvector setup (5 minutes, free tier available).

On **Vercel**: add env vars under Project → Settings → Environment Variables, then redeploy.

## How it works

1. **Auth Gate** — if `SITE_PASSWORD` is set, user must enter password (stored in sessionStorage).
2. `/api/search` — YouTube channel search (mock list without key).
3. `/api/embed` — lists videos with filters, fetches transcripts via **Supadata API** (fallback to scraping if unavailable), chunks (~900 chars), embeds with OpenAI, stores in **Postgres with pgvector**.
4. `/api/chat` — embeds the question, **pgvector cosine similarity search** for top chunks, asks the model to answer **in the creator's voice** citing `[n]` sources.

## Transcript Strategy

1. **Supadata API** (primary, bypasses YouTube datacenter IP blocks)
2. Watch page scraping (fallback, brittle)
3. Mock segments (dev mode)

## Architecture

```
User → Next.js API Routes
         ↓
    Postgres + pgvector (persistent embeddings)
         ↓
    OpenAI (embeddings + chat)
```

**Why pgvector?**
- Vercel serverless functions don't share memory between instances
- Without persistence, embeddings are lost on every cold start
- pgvector provides fast cosine similarity search at database level

## Roadmap

- [x] Persist embeddings in Postgres + pgvector
- [ ] Streaming chat responses
- [ ] Whisper fallback for videos without captions
- [ ] Progress UI during embedding (per-video status)
- [ ] Better Shorts detection + date-range filter
- [ ] Async job polling for large Supadata transcripts
- [ ] Incremental embedding (only new videos)
