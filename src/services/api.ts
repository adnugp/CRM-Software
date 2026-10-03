import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import app from './firebase';
import {apiErrorMessage} from '@/lib/api-errors';

const functions = getFunctions(app, import.meta.env.VITE_FUNCTIONS_REGION || 'us-central1');
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export async function callApi<T = Record<string, unknown>>(name: string, input: unknown): Promise<T> {
  try {
    const result = await httpsCallable<unknown, T>(functions, name, {timeout:180000})(input);
    return result.data;
  } catch(error) { throw new Error(apiErrorMessage(error,import.meta.env.VITE_USE_EMULATORS==='true'),{cause:error}); }
}

let workspaceId: string | null = null;
export function setApiWorkspace(id: string | null) { workspaceId = id; }
export function requireWorkspace(): string {
  if (!workspaceId) throw new Error('Select a workspace before accessing business records.');
  return workspaceId;
}
