// Servers for the parallel-mode reproduction. They start in the launcher
// (onPrepare), and the workers get their addresses through the environment.
import http from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const listen = (handler) => new Promise((resolve) => {
  const server = http.createServer(handler).listen(0, '127.0.0.1', () => resolve(server));
});
const port = (server) => server.address().port;

export async function startServers(outFile) {
  // Stand-in for the Percy CLI server: records the snapshot bodies and the
  // log lines that the SDK sends.
  const domJs = fs.readFileSync(require.resolve('@percy/dom'));
  const recorded = { snapshots: [], logs: [] };
  const percy = await listen((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const json = (data) => {
        res.writeHead(200, { 'content-type': 'application/json', 'x-percy-core-version': '1.32.12' });
        res.end(JSON.stringify(data));
      };
      if (req.url === '/percy/healthcheck') return json({ success: true, type: 'web', config: { snapshot: {} } });
      if (req.url === '/percy/dom.js') { res.writeHead(200); return res.end(domJs); }
      if (req.url.startsWith('/percy/snapshot')) {
        recorded.snapshots.push(JSON.parse(body));
        return json({ success: true, data: {} });
      }
      if (req.url.startsWith('/percy/log') && body) {
        try { recorded.logs.push(JSON.parse(body)); } catch {}
      }
      json({ success: true });
    });
  });

  // The iframe uses localhost and the page uses 127.0.0.1: other origin.
  const frameSite = await listen((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><title>frame</title><p>Cross-origin frame of ${req.url}</p>`);
  });
  const pages = await listen((req, res) => {
    const name = req.url.slice(1) || 'index';
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><title>Page ${name}</title><h1>Page ${name}</h1>
      <iframe src="http://localhost:${port(frameSite)}/${name}"></iframe>`);
  });

  process.env.PERCY_SERVER_ADDRESS = `http://127.0.0.1:${port(percy)}`;
  process.env.REPRO_BASE_URL = `http://127.0.0.1:${port(pages)}/`;

  return async function stop() {
    fs.mkdirSync(new URL('.', outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(recorded, null, 2));
    for (const server of [percy, frameSite, pages]) server.close();
  };
}
