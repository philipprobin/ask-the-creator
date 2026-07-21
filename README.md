# Ask the Creator

<p>
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-green.svg">
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg">
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/philipprobin/ask-the-creator?style=flat&color=yellow">
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/philipprobin/ask-the-creator?style=flat">
  <img alt="GitHub issues" src="https://img.shields.io/github/issues/philipprobin/ask-the-creator">
  <img alt="Last commit" src="https://img.shields.io/github/last-commit/philipprobin/ask-the-creator">
</p>

<p>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  <img alt="OpenAI" src="https://img.shields.io/badge/OpenAI-412991?logo=openai&logoColor=white">
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white">
  <img alt="Self-hosted" src="https://img.shields.io/badge/self--hosted-BYO%20keys-6E56CF">
</p>

**Ask any YouTube creator a question and get an answer in their voice — grounded only in their actual videos, with clickable sources.**

Pick a creator, type a question, and the app scores every video in their library for relevance, pulls the transcripts of the ones you choose, and answers from them — citing the exact videos (and timestamps) it used.

Self-hosted, bring-your-own-API-keys. Runs locally with zero cloud services by default.

<!-- Add a demo GIF at docs/demo.gif and it renders here -->
<!-- ![demo](docs/demo.gif) -->

---

## Features

- 🎙️ **Answers in the creator's voice** — grounded strictly in their real transcripts, never made up.
- 🔗 **Inline `[n]` citations** — every claim links back to the exact video (with timestamp).
- 🎬 **Videos *and* Shorts** — pull up to 150 of each, toggle either on/off, mixed and ranked by relevance.
- 🧠 **LLM-only by default, RAG when it needs to scale** — no vector DB for normal libraries; automatic fallback above a token threshold.
- 🔑 **Bring your own keys, set them in-app** — a setup wizard on first run + a ⚙️ settings panel to edit/add keys anytime.
- 💸 **Live cost tracking** — persistent token + USD estimate right in the sidebar.
- 📝 **Markdown answers** — headings, lists, tables and emphasis for readable, well-structured responses.
- 🗄️ **Zero-cloud default** — local SQLite file; swap to Postgres + pgvector just by setting `DATABASE_URL`.
- 🆓 **Keyless YouTube fallback** — channel search + metadata work without a Google Cloud key.

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
1. Pick a creator            →  YouTube channel search (keyless or Data API)
2. Ask a question            →  up to 150 videos + 150 Shorts are embedded and
                                 ranked by cosine similarity to your question
3. Choose the best matches   →  top 10 pre-selected (any mix of video/short);
                                 only those are transcribed + indexed (lazy)
4. Get an answer             →  grounded in the transcripts, rendered as Markdown
                                 with clickable [n] source chips
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
