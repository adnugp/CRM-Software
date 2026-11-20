// Changing one item in a list stored on a record (project tasks, costs,
// documents, team members). Each function returns a new list and leaves the
// others untouched, so it can be applied to the newest copy of the record in
// a transaction (changeRecordList in src/services/firestore.ts). No imports,
// so the unit tests run this file directly.

export type ListChange<T> = (current: T[]) => T[];

export function addItem<T extends { id: string }>(list: T[] | undefined, item: T): T[] {
  const current = list ?? [];
  return current.some(x => x.id === item.id) ? current : [...current, item];
}

/** Keys whose patch value is undefined are removed from the item. */
export function updateItem<T extends { id: string }>(list: T[] | undefined, id: string, patch: Partial<T>): T[] {
  return (list ?? []).map(item => {
    if (item.id !== id) return item;
    const next: Record<string, unknown> = { ...item, ...patch };
    for (const [key, value] of Object.entries(patch)) if (value === undefined) delete next[key];
    return next as T;
  });
}

export function removeItem<T extends { id: string }>(list: T[] | undefined, id: string): T[] {
  return (list ?? []).filter(item => item.id !== id);
}

/** Documents have no id: they are keyed by their download URL (`data`). */
export function addDocuments<D extends { data: string }>(list: D[] | undefined, docs: D[]): D[] {
  const current = list ?? [];
  const have = new Set(current.map(d => d.data));
  return [...current, ...docs.filter(d => !have.has(d.data))];
}

export function removeDocument<D extends { data: string }>(list: D[] | undefined, url: string): D[] {
  return (list ?? []).filter(d => d.data !== url);
}

export function addId(list: string[] | undefined, id: string): string[] {
  const current = list ?? [];
  return current.includes(id) ? current : [...current, id];
}

export function removeId(list: string[] | undefined, id: string): string[] {
  return (list ?? []).filter(x => x !== id);
}
