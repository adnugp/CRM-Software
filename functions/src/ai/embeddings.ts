import {createHash} from "node:crypto";
export function embeddingConfiguration(): string | null {
  return process.env.AI_EMBEDDING_ENDPOINT && process.env.AI_EMBEDDING_MODEL ? createHash("sha256").update(`${process.env.AI_EMBEDDING_ENDPOINT}|${process.env.AI_EMBEDDING_MODEL}`).digest("hex") : null;
}
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0; let x = 0; let y = 0;
  for (let i = 0; i < a.length; i++) {dot += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i];}
  return x && y ? dot / Math.sqrt(x * y) : 0;
}
export async function embed(texts: string[], transport: typeof fetch = fetch): Promise<number[][] | null> {
  if (!embeddingConfiguration()) return null;
  if (process.env.NODE_ENV === "test" && transport === fetch) throw new Error("Live embedding calls disabled in tests");
  const endpoint = process.env.AI_EMBEDDING_ENDPOINT!;
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && !(process.env.AI_PROVIDER === "ollama" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("Embedding endpoint must use HTTPS (local Ollama may use HTTP)");
  const result: number[][] = [];
  for (let start = 0; start < texts.length; start += 20) {
    const input = texts.slice(start, start + 20).map(text => text.slice(0, 4000));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await transport(endpoint, {method: "POST", signal: controller.signal, headers: {"Content-Type": "application/json", ...(process.env.AI_EMBEDDING_API_KEY || process.env.AI_API_KEY ? {Authorization: `Bearer ${process.env.AI_EMBEDDING_API_KEY || process.env.AI_API_KEY}`} : {})}, body: JSON.stringify({model: process.env.AI_EMBEDDING_MODEL, input})});
      if (!response.ok) throw new Error("Embedding provider unavailable");
      const payload: any = await response.json();
      if (!Array.isArray(payload.data) || payload.data.length !== input.length) throw new Error("Invalid embedding provider response");
      const rows = [...payload.data].sort((a, b) => a.index - b.index).map(row => row.embedding);
      if (rows.some(vector => !Array.isArray(vector) || !vector.length || vector.length > 2048 || vector.some((v: unknown) => typeof v !== "number" || !Number.isFinite(v)))) throw new Error("Embedding vectors must contain 1–2048 finite dimensions");
      result.push(...rows);
    } finally {clearTimeout(timer);}
  }
  return result;
}
