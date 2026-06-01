import { config, hasOpenAI } from "./config";
import type { RetrievedSource } from "./types";

const OPENAI = "https://api.openai.com/v1";

function buildContext(sources: RetrievedSource[]): string {
  return sources
    .map(
      (s, i) =>
        `[${i + 1}] (video: "${s.videoTitle}", t=${Math.floor(s.start)}s)\n${s.text}`
    )
    .join("\n\n");
}

export async function answer(
  channelTitle: string,
  question: string,
  sources: RetrievedSource[]
): Promise<string> {
  if (!hasOpenAI()) {
    const top = sources[0];
    return (
      `(Mock-Antwort — setze OPENAI_API_KEY für echte Antworten.)\n\n` +
      `So wie ${channelTitle} es sagen würde: ${
        top ? `"${top.text.slice(0, 180)}…"` : "Dazu finde ich nichts in den Transkripten."
      }`
    );
  }

  const system = `Du bist ein KI-Avatar des YouTubers "${channelTitle}". ` +
    `Antworte in der ersten Person, im Tonfall und Stil dieses Creators, ` +
    `ausschließlich basierend auf den bereitgestellten Transkript-Auszügen. ` +
    `Erfinde nichts. Wenn die Auszüge die Frage nicht abdecken, sag das ehrlich. ` +
    `Verweise auf Quellen mit [1], [2] usw. passend zu den Auszügen.`;

  const user = `Frage: ${question}\n\nTranskript-Auszüge:\n${buildContext(sources)}`;

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
  return data.choices?.[0]?.message?.content ?? "(keine Antwort)";
}
