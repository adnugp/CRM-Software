import {complete, ModelMessage} from "./provider";
import {WRITE_TOOLS} from "./core";

// Sequential lookups need separate rounds on models that do not parallelize
// calls: project, employee, proposal, then a final response. Keep a hard bound.
export async function runModel(messages: ModelMessage[], tools: any[], execute: (name: string, args: any) => Promise<any>, model: typeof complete = complete) {
  let proposal: any;
  let reply = "";
  for (let round = 0; round < 5; round++) {
    const result = await model(messages, round < 4 ? tools : []);
    if (!result.tool_calls?.length) {reply = String(result.content || "I could not produce a response. Please try again.").slice(0, 8000); break;}
    if (round === 4 || result.tool_calls.length > 4) throw new Error("AI requested too many actions");
    messages.push({role: "assistant", content: result.content || "", tool_calls: result.tool_calls});
    for (const call of result.tool_calls) {
      let output: any;
      try {
        if (proposal && WRITE_TOOLS.includes(call.function?.name)) throw new Error("Only one proposal per response");
        output = await execute(call.function?.name, JSON.parse(call.function?.arguments || "{}"));
        if (output.proposal) proposal = output.proposal;
      } catch (error) {output = {error: error instanceof Error ? error.message : "Action unavailable"};}
      const modelOutput = output.proposal ? {proposal: {id: output.proposal.id, summary: output.proposal.summary, tool: output.proposal.tool, expiresAt: output.proposal.expiresAt}} : output;
      messages.push({role: "tool", tool_call_id: call.id, content: JSON.stringify(modelOutput)});
    }
  }
  return {reply, proposal};
}
