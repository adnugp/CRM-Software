/** Fail closed if a response contains unscoped or foreign business records. */
export function assertWorkspaceRecords<T extends {workspaceId?:string}>(workspaceId:string,records:T[]):T[] {
 if(!workspaceId||records.some(record=>record.workspaceId!==workspaceId))throw new Error('Records do not match the selected workspace. Refresh before continuing.');
 return records;
}
