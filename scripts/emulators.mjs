// Starts the local Firebase emulators (Auth, Firestore, Storage + UI) for the
// "demo-crm" project. Data is saved to .emulator-data/ when you stop them with
// Ctrl+C and loaded again next time. Run `npm run seed` to reset to sample data.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const DATA_DIR = '.emulator-data';
const args = ['emulators:start', '--only', 'auth,firestore,storage', '--project', 'demo-crm', '--export-on-exit', DATA_DIR];
if (existsSync(DATA_DIR)) args.push('--import', DATA_DIR);
else console.log('No saved local data yet. After the emulators start, run `npm run seed` in another terminal.\n');

const child = spawn('firebase', args, { stdio: 'inherit', shell: true });

// Ctrl+C reaches the emulators too; stay alive until they finish saving data.
process.on('SIGINT', () => {});
child.on('exit', (code) => process.exit(code ?? 0));
