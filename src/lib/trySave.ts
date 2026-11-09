import { toast } from '@/hooks/use-toast';

/**
 * Runs a save. On failure shows "Not saved" and returns false, so the form can
 * stay open and nothing typed is lost (e.g. a read-only company).
 */
export async function trySave(save: () => unknown): Promise<boolean> {
  try {
    await save();
    return true;
  } catch (error) {
    toast({ title: 'Not saved', description: saveErrorMessage(error), variant: 'destructive' });
    return false;
  }
}

// Firestore's own permission text ("PERMISSION_DENIED: evaluation error at L329…")
// means nothing to people, so say what it usually means instead.
function saveErrorMessage(error: unknown): string {
  if ((error as { code?: string })?.code === 'permission-denied') {
    return "You don't have permission to change this, or your company is read-only.";
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
