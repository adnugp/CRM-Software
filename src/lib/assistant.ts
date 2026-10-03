export interface AssistantChoice {id:string;name:string;}
export interface AssistantSuggestions {records:Record<string,AssistantChoice[]>;scope:string;}
export const isAssistantQuickPrompt = (message:string) => /^(show|list)\s+(?:(?:my\s+)?(?:upcoming\s+|overdue\s+)?deadlines|unpaid invoices|workspace overview|tenders|daily briefing|project risks)[.!?]?$/i.test(message.trim());
export function assistantRetry(error:unknown):{scope?:string;seconds?:number} {
  const details=(error as {cause?:{details?:{scope?:string;retryAfterSeconds?:number}}})?.cause?.details;
  if(!details)return {};
  const seconds=Number(details.retryAfterSeconds);
  return {scope:details.scope,...(Number.isFinite(seconds)&&seconds>0?{seconds:Math.min(3600,Math.ceil(seconds))}:{})};
}
export function assistantSuggestionsPrompt(kind:string, choice:AssistantChoice) {
  const name=JSON.stringify(choice.name);
  if(kind==='projects')return `Summarize project ${name} (ID ${choice.id}), including its tasks and assignments.`;
  if(kind==='tenders')return `Create a draft checklist for tender ${name} (ID ${choice.id}). Review its existing checklist first and ask before replacing it.`;
  if(kind==='customers')return `Draft a concise follow-up email for customer ${name} (ID ${choice.id}). Use verified CRM context, leave missing details as placeholders, and do not send it.`;
  if(kind==='invoices')return `Draft a polite payment reminder for invoice ${name} (ID ${choice.id}). Read the exact invoice first, use its outstanding balance and currency, do not invent a recipient, and do not send it.`;
  return `Analyze the indexed document ${name} (file ID ${choice.id}). Extract tender requirements, submission dates, and required documents with page/sheet sources. Separate missing evidence from requirements and provide a draft checklist in the answer. State the excerpt limits. Do not change records.`;
}
