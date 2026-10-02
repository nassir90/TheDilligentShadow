// Drives a separate headless Chrome (its own throwaway profile) over the DevTools protocol, for recording frames
// without the throttling a hidden browser pane gets.
//   node cdp.mjs launch <profile dir>           start Chrome on port 9333
//   node cdp.mjs open <url>                     navigate the page tab
//   node cdp.mjs eval <file.js | -e code>       evaluate in the page (awaits promises), prints the result
//   node cdp.mjs quit
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const PORT = 9333, BASE = `http://127.0.0.1:${PORT}`;
const [cmd, ...args] = process.argv.slice(2);

async function pageWs() {
  const list = await (await fetch(`${BASE}/json/list`)).json();
  // TAB=<name> drives a second tab of its own (kept apart by a #tab=<name> in its URL), so compositing can run
  // while a recording holds the default tab
  const tab = process.env.TAB, mine = t => t.type === 'page' && (tab ? t.url.includes('#tab=' + tab) : !t.url.includes('#tab='));
  let p = list.find(mine);
  if (!p) p = await (await fetch(`${BASE}/json/new?about:blank${tab ? '%23tab=' + tab : ''}`, { method: 'PUT' })).json();
  return p.webSocketDebuggerUrl;
}
function rpc(url) {
  const ws = new WebSocket(url); let id = 0; const wait = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } };
  const ready = new Promise(r => ws.onopen = r);
  return { ready, close: () => ws.close(), send: (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }) };
}

if (cmd === 'launch') {
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const p = spawn(chrome, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${args[0]}`, '--no-first-run', '--no-default-browser-check',
    '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--window-size=1280,900', 'about:blank'], { detached: true, stdio: 'ignore' });
  p.unref();
  for (let i = 0; i < 50; i++) { try { await fetch(`${BASE}/json/version`); console.log('chrome up, pid', p.pid); process.exit(0); } catch { await new Promise(r => setTimeout(r, 200)); } }
  console.log('chrome did not start'); process.exit(1);
}
if (cmd === 'quit') { const c = rpc((await (await fetch(`${BASE}/json/version`)).json()).webSocketDebuggerUrl); await c.ready; await c.send('Browser.close'); process.exit(0); }
const c = rpc(await pageWs()); await c.ready;
if (cmd === 'open') {
  await c.send('Page.enable'); await c.send('Page.navigate', { url: args[0] + (process.env.TAB ? '#tab=' + process.env.TAB : '') });
  for (let i = 0; i < 100; i++) { const r = await c.send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }); if (r.result?.result?.value === 'complete') break; await new Promise(r => setTimeout(r, 100)); }
  console.log('opened', args[0]);
} else if (cmd === 'eval') {
  const code = args[0] === '-e' ? args[1] : readFileSync(args[0], 'utf8');
  const r = await c.send('Runtime.evaluate', { expression: `(async () => { ${code} })()`, awaitPromise: true, returnByValue: true, timeout: 3.6e6 });
  if (r.result?.exceptionDetails) { console.log('ERROR', JSON.stringify(r.result.exceptionDetails).slice(0, 1500)); process.exit(1); }
  const v = r.result?.result?.value; console.log(typeof v === 'string' ? v : JSON.stringify(v));
}
c.close(); process.exit(0);
