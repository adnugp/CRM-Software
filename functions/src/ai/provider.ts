export type ModelMessage = {role: string; content?: string; tool_calls?: any[]; tool_call_id?: string};
export class ProviderRateLimit extends Error {
  constructor(public retryAfterSeconds:number) {super('AI provider rate limit reached. Please wait before retrying free-form questions. CRM quick answers remain available; no billing upgrade has been made.');}
}
export function retryDelay(value:string|null, now=Date.now()) {
  const seconds=value!==null&&/^\d+(\.\d+)?$/.test(value)?Number(value):value?(Date.parse(value)-now)/1000:60;
  return Math.min(3600,Math.max(1,Math.ceil(Number.isFinite(seconds)?seconds:60)));
}
export async function complete(messages: ModelMessage[], tools: any[], transport: typeof fetch = fetch): Promise<any> {
  const provider = process.env.AI_PROVIDER;
  const model = process.env.AI_MODEL;
  if (!model || !["hosted", "ollama"].includes(provider || "")) throw new Error("AI is unavailable: configure AI_PROVIDER and AI_MODEL");
  if (process.env.NODE_ENV === "test" && transport === fetch) throw new Error("Live provider calls disabled in tests");
  const endpoint = process.env.AI_ENDPOINT;
  if (!endpoint) throw new Error("AI is unavailable: configure AI_ENDPOINT");
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && !(provider === "ollama" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname))) throw new Error("AI endpoint must use HTTPS (local Ollama may use HTTP)");
  if (provider === "hosted" && !process.env.AI_API_KEY) throw new Error("AI is unavailable: configure AI_API_KEY secret");
  for (let attempt = 0; attempt < 2; attempt++) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 20000);
    try {
      const response = await transport(endpoint, {method: "POST", signal: abort.signal, headers: {"Content-Type": "application/json", ...(process.env.AI_API_KEY ? {Authorization: `Bearer ${process.env.AI_API_KEY}`} : {})},
        body: JSON.stringify({model, messages, tools, tool_choice: "auto", temperature: 0, max_tokens: 1200})});
      if (!response.ok) {
        if (response.status === 429) throw new ProviderRateLimit(retryDelay(response.headers?.get('retry-after')||null));
        if (attempt === 0 && [502, 503, 504].includes(response.status)) continue;
        throw new Error(`AI provider unavailable (${response.status})`);
      }
      const payload: any = await response.json();
      const message = payload.choices?.[0]?.message;
      if (!message || (typeof message.content !== "string" && !Array.isArray(message.tool_calls))) throw new Error("Invalid AI provider response");
      return message;
    } catch (error) {
      if (attempt === 1 || !(error instanceof Error) || error.name !== "AbortError") throw error;
    } finally {clearTimeout(timer);}
  }
  throw new Error("AI provider timed out");
}
