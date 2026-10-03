export function apiErrorMessage(error:unknown,local:boolean):string {
 const detail=error as {code?:string;message?:string};
 if(['functions/internal','functions/unavailable','functions/not-found'].includes(detail?.code||'')&&(!detail.message||/^(internal|unavailable|not found)$/i.test(detail.message))){
  return local?'The local workspace backend is unavailable. Start it with npm run dev:backend and retry.':'The workspace service is unavailable. Check that the Firebase functions are deployed to the configured project and region.';
 }
 return detail?.message||'Unable to complete this request. Please retry.';
}
