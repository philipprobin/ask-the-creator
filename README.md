# ask-the-creator

Chat with any YouTuber, grounded in their own video transcripts (RAG).

Flow: **search a channel → pick filters (Shorts/videos, count, order) → "Embetten" → RAG chat** with answers in the creator's style and clickable video+timestamp sources.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- YouTube Data API v3 (channel search, video listing)
- YouTube timedtext (transcripts, no extra deps)
- OpenAI embeddings + chat
- In-memory vector store (per warm serverless instance) — see Roadmap for pgvector

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
| `YOUTUBE_API_KEY` | channel/video search | Google Cloud Console → enable "YouTube Data API v3" |
| `DATABASE_URL` | (optional) pgvector persistence | Vercel Postgres / Neon |

On **Vercel**: add `OPENAI_API_KEY` and `YOUTUBE_API_KEY` under Project → Settings → Environment Variables, then redeploy.

## How it works

1. `/api/search` — YouTube channel search (mock list without key).
2. `/api/embed` — lists videos with filters, fetches transcripts, chunks (~900 chars), embeds, stores per channel.
3. `/api/chat` — embeds the question, cosine-search top chunks, asks the model to answer **in the creator's voice** citing `[n]` sources.

## Roadmap

- [ ] Persist embeddings in Postgres + pgvector (`DATABASE_URL`) so they survive redeploys.
- [ ] Streaming chat responses.
- [ ] Whisper fallback for videos without captions.
- [ ] Progress UI during embedding (per-video status).
- [ ] Better Shorts detection + date-range filter.
