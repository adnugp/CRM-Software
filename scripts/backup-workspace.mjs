import { writeFile } from 'node:fs/promises';
import { args, connect, readTree } from './admin-common.mjs';
const options = args();
const { db } = connect(options);
if (typeof options.output !== 'string') throw Error('--output required');
const documents = await readTree(db, `workspaces/${options.workspace}`);
await writeFile(options.output, JSON.stringify({ version: 1, projectId: options.project, workspaceId: options.workspace, createdAt: new Date().toISOString(), documents }, null, 2), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ project: options.project, workspace: options.workspace, documents: documents.length, output: options.output }));
