/**
 * Deterministic per-entity accent colors. Same key → same hue, so a creator or
 * a source keeps a stable color across the app (avatar, card strip, chips).
 */
export interface Accent {
  /** solid color — number badges, rings, dots */
  solid: string;
  /** soft tinted background */
  soft: string;
  /** readable foreground on the soft background */
  fg: string;
  /** two-stop gradient — hero-ish surfaces & avatar fallbacks */
  grad: string;
}

export const ACCENTS: Accent[] = [
  { solid: "#2f4bff", soft: "#eef1ff", fg: "#182bb0", grad: "linear-gradient(135deg,#2f4bff,#6f7bff)" }, // blue
  { solid: "#7c3aed", soft: "#f3e8ff", fg: "#6b21a8", grad: "linear-gradient(135deg,#7c3aed,#a855f7)" }, // violet
  { solid: "#0d9488", soft: "#ccfbf1", fg: "#0f766e", grad: "linear-gradient(135deg,#0d9488,#2dd4bf)" }, // teal
  { solid: "#ff5c38", soft: "#fff2ee", fg: "#bd3316", grad: "linear-gradient(135deg,#ff5c38,#ff8a5c)" }, // coral
  { solid: "#db2777", soft: "#fce7f3", fg: "#9d174d", grad: "linear-gradient(135deg,#db2777,#f472b6)" }, // pink
  { solid: "#f59e0b", soft: "#fef3c7", fg: "#b45309", grad: "linear-gradient(135deg,#f59e0b,#fbbf24)" }, // amber
  { solid: "#16a34a", soft: "#dcfce7", fg: "#15803d", grad: "linear-gradient(135deg,#16a34a,#4ade80)" }, // green
  { solid: "#0891b2", soft: "#cffafe", fg: "#155e75", grad: "linear-gradient(135deg,#0891b2,#22d3ee)" }, // cyan
];

/** Stable string hash → accent index. */
export function accentFor(key: string): Accent {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return ACCENTS[Math.abs(h) % ACCENTS.length];
}
