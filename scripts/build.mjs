import { cp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
const server = process.env.GAME_SERVER_URL || '';
if (server && !/^https:\/\/[a-z0-9.-]+$/.test(server)) throw new Error('GAME_SERVER_URL must be an HTTPS origin');
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await writeFile('dist/config.js', `export const API_ORIGIN = ${JSON.stringify(server)};\n`);
if (server) {
  const headers = await readFile('dist/_headers', 'utf8');
  await writeFile('dist/_headers', headers.replace('https://*.workers.dev wss://*.workers.dev', `${server} ${server.replace('https:', 'wss:')}`));
}
console.log('Built Pages frontend in dist/');
