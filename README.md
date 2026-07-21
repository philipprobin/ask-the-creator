# Ask the Creator

**Ask any YouTube creator a question and get an answer in their voice — grounded only in their actual videos, with clickable sources.**

Pick a creator, type a question, and the app scores every video in their library for relevance, pulls the transcripts of the ones you choose, and answers from them — citing the exact videos (and timestamps) it used.

Self-hosted, bring-your-own-API-keys. Runs locally with zero cloud services by default.

<!-- Add a demo GIF at docs/demo.gif and it renders here -->
<!-- ![demo](docs/demo.gif) -->

---

## Quickstart

### Local (recommended — zero cloud setup)

```bash
git clone https://github.com/philipprobin/ask-the-creator
cd ask-the-creator
npm install
npm run dev
```

Open http://localhost:3000 — a **setup wizard** asks for your API keys on first run (and validates them). That's it: embeddings, transcripts, and chat history are stored in a local SQLite file under `data/`.

### Docker

```bash
docker compose up
```

Same thing, containerized. Set keys in the wizard or pass them as environment variables (see below).

---

## What you need

| Key | Purpose | Required? | Where |
|---|---|---|---|
| **OpenAI** | Embeddings + answer generation | **Yes** | [platform.openai.com](https://platform.openai.com/api-keys) |
| **YouTube Data API v3** | Channel search + video metadata | Optional (keyless fallback) | [Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com) |
| **Supadata** | YouTube transcripts | Recommended (free tier) | [supadata.ai](https://supadata.ai) |

> **No GCP key?** Channel search + video metadata fall back to keyless `youtubei.js`, so the YouTube Data API key is optional (a set key is used when present — it's more robust and includes descriptions). Only two caveats: keyless scoring is title-only, and youtubei.js can break when YouTube changes its internals.
>
> **Why Supadata for transcripts?** Transcript extraction *is* reliably blocked by YouTube's anti-bot measures (youtubei.js `get_transcript` / timedtext), so transcripts do need Supadata (free tier) — there's no keyless path there.

Enter keys in the in-app wizard (saved to `data/config.json`, git-ignored) or via environment variables. **Environment variables always win** — set them in hosted deploys.

---

## How it works

```
1. Pick a creator            →  YouTube channel search
2. Ask a question            →  every video's title+description is embedded and
                                 ranked by cosine similarity to your question
3. Choose the best matches   →  only those videos are transcribed + indexed (lazy)
4. Get an answer             →  grounded in the transcripts, with source chips
```

**Answering is LLM-only by default.** For a normal creator the selected transcripts fit comfortably in the model's context window, so they're stuffed in directly — **no vector database required**. Only when the corpus exceeds a token threshold (`LLM_ONLY_MAX_TOKENS`, default 100k) does it fall back to **RAG** (vector search over chunks). This keeps the default setup dependency-free while scaling to large libraries.

---

## Two ways to run

| | **Local / self-host** | **Hosted (e.g. Vercel)** |
|---|---|---|
| Storage | SQLite file (`data/`) | Postgres + pgvector (set `DATABASE_URL`, e.g. Supabase/Neon) |
| Transcripts | Supadata key | Supadata key (needed — datacenter IPs are blocked) |
| Keys | In-app wizard → `data/config.json` | Environment variables |

The same codebase serves both — it auto-detects Postgres when `DATABASE_URL` is set, otherwise uses SQLite.

## Configuration

All env vars are optional except `OPENAI_API_KEY`. See [`.env.example`](.env.example) for the full list (`STORAGE_BACKEND`, `SQLITE_PATH`, `LLM_ONLY_MAX_TOKENS`, model overrides, `SITE_PASSWORD`).

## Cost

Runs on your own OpenAI key. The sidebar shows a live cost estimate (tokens × current model prices). With the defaults (`gpt-4o-mini`, `text-embedding-3-small`) a typical question costs a fraction of a cent.

## Tech stack

Next.js 15 (App Router) · TypeScript · OpenAI (chat + embeddings) · SQLite (`better-sqlite3`) / Postgres + pgvector · Supadata (transcripts) · YouTube Data API.

## ⚠️ Legal / fair use

This is a **personal research and learning tool**. It fetches transcripts of publicly available videos and generates answers grounded in them, for the person running the instance. You are responsible for complying with YouTube's Terms of Service, the API providers' terms, and applicable copyright law in your jurisdiction. It is **not** intended to republish, redistribute, or commercially exploit creators' content. Bring your own API keys; each self-hosted instance operates under its own responsibility.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs welcome.

## License

[MIT](LICENSE)
