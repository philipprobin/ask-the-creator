import { config, hasOpenAI } from "./config";
import type { RetrievedSource } from "./types";

const OPENAI = "https://api.openai.com/v1";

export interface LlmUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface AnswerResult {
  text: string;
  usage: LlmUsage | null;
}

/** How the creator's content is supplied to the model. */
export type AnswerContext =
  | { mode: "rag"; sources: RetrievedSource[] } // top-k retrieved chunks (large libraries)
  | { mode: "full"; transcript: string }; // full transcripts stuffed into context (default)

function buildContext(sources: RetrievedSource[]): string {
  return sources
    .map((s, i) => `[${i + 1}] (video: "${s.videoTitle}", t=${Math.floor(s.start)}s)\n${s.text}`)
    .join("\n\n");
}

export async function answer(
  channelTitle: string,
  question: string,
  ctx: AnswerContext
): Promise<AnswerResult> {
  if (!hasOpenAI()) {
    const snippet =
      ctx.mode === "rag"
        ? ctx.sources[0]?.text.slice(0, 180)
        : ctx.transcript.slice(0, 180);
    return {
      text:
        `(Mock-Antwort — setze OPENAI_API_KEY für echte Antworten.)\n\n` +
        `So wie ${channelTitle} es sagen würde: ${snippet ? `"${snippet}…"` : "Dazu finde ich nichts in den Transkripten."}`,
      usage: null,
    };
  }

  const citation =
    ctx.mode === "rag"
      ? `Verweise auf Quellen mit [1], [2] usw. passend zu den Auszügen.`
      : `Stütze dich ausschließlich auf die Transkripte und nenne, aus welchem Video eine Aussage stammt.`;

  const system =
    `Du bist ein KI-Avatar des YouTubers "${channelTitle}". ` +
    `Antworte in der ersten Person, im Tonfall und Stil dieses Creators, ` +
    `ausschließlich basierend auf den bereitgestellten Transkripten. ` +
    `Erfinde nichts. Wenn die Transkripte die Frage nicht abdecken, sag das ehrlich. ` +
    citation;

  const user =
    ctx.mode === "rag"
      ? `Frage: ${question}\n\nTranskript-Auszüge:\n${buildContext(ctx.sources)}`
      : `Frage: ${question}\n\nVollständige Transkripte des Creators:\n${ctx.transcript}`;

  const res = await fetch(`${OPENAI}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.chatModel,
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI chat failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  const u = data.usage;
  return {
    text: data.choices?.[0]?.message?.content ?? "(keine Antwort)",
    usage: u
      ? { model: config.chatModel, promptTokens: u.prompt_tokens ?? 0, completionTokens: u.completion_tokens ?? 0 }
      : null,
  };
}
