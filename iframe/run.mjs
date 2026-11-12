// A cross-origin iframe that fails to load is sent to Percy as captured
// content in Chrome: its document is Chrome's error page
// (chrome-error://chromewebdata/). Firefox gives about:neterror, which the
// SDK skips.
//
// Usage: node iframe/run.mjs <chrome|firefox> [classic]
// Exit code 1: the error page was sent as an iframe (bug present).
import http from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { remote } from 'webdriverio';

const require = createRequire(import.meta.url);
const [browserName = 'chrome', mode = 'bidi'] = process.argv.slice(2);
const version = (pkg) => JSON.parse(fs.readFileSync(`node_modules/${pkg}/package.json`, 'utf8')).version;

const listen = (handler) => new Promise((resolve) => {
  const server = http.createServer(handler).listen(0, '127.0.0.1', () => resolve(server));
});
const port = (server) => server.address().port;

// Small stand-in for the Percy CLI server. It answers the three endpoints
// that the SDK calls and records the snapshot body that the SDK sends.
const domJs = fs.readFileSync(require.resolve('@percy/dom'));
const snapshots = [];
const percy = await listen((req, res) => {
  const json = (body) => {
    res.writeHead(200, { 'content-type': 'application/json', 'x-percy-core-version': version('@percy/sdk-utils') });
    res.end(JSON.stringify(body));
  };
  if (req.url === '/percy/healthcheck') return json({ success: true, type: 'web', config: { snapshot: {} } });
  if (req.url === '/percy/dom.js') { res.writeHead(200); return res.end(domJs); }
  if (req.url.startsWith('/percy/snapshot')) {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => { snapshots.push(JSON.parse(data)); json({ success: true, data: {} }); });
    return;
  }
  json({ success: true });
});
process.env.PERCY_SERVER_ADDRESS = `http://127.0.0.1:${port(percy)}`;

// A port with nothing on it: the iframe that points to it fails to load.
const closed = await listen(() => {});
const closedPort = port(closed);
await new Promise((resolve) => closed.close(resolve));

// The iframes use localhost and the page uses 127.0.0.1: other origin.
const frameSite = await listen((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><title>ok frame</title><p>Cross-origin frame that loaded</p>');
});
const page = await listen((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(`<!doctype html><title>Main page</title><h1>Main page</h1>
    <iframe id="ok" src="http://localhost:${port(frameSite)}/frame"></iframe>
    <iframe id="bad" src="http://localhost:${closedPort}/missing"></iframe>`);
});

const capabilities = {
  browserName,
  'goog:chromeOptions': { args: ['--headless=new'] },
  'moz:firefoxOptions': { args: ['-headless'] }
};
if (mode === 'classic') capabilities['wdio:enforceWebDriverClassic'] = true;

const percySnapshot = require('@percy/webdriverio');
const browser = await remote({ logLevel: 'error', capabilities });
try {
  console.log(`webdriverio ${version('webdriverio')}, @percy/webdriverio ${version('@percy/webdriverio')}, @percy/sdk-utils ${version('@percy/sdk-utils')}`);
  console.log(`${browserName} ${browser.capabilities.browserVersion}, ${browser.isBidi ? 'BiDi' : 'Classic'} session`);
  await browser.url(`http://127.0.0.1:${port(page)}/`);
  await browser.pause(1500); // let the bad iframe fail
  await percySnapshot(browser, 'Main page');
} finally {
  await browser.deleteSession();
  page.close();
  frameSite.close();
  percy.close();
}

const frames = snapshots[0]?.domSnapshot?.corsIframes || [];
console.log(`\ncorsIframes sent to Percy: ${frames.length}`);
for (const frame of frames) {
  const text = (frame.iframeSnapshot?.html || '')
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(`- frameUrl: ${frame.frameUrl}`);
  console.log(`  text:     ${text.slice(0, 100)}`);
}

const errorPages = frames.filter((frame) => /^chrome-error:/i.test(frame.frameUrl || ''));
if (errorPages.length) {
  console.log('\nBUG: the browser error page of the failed iframe was sent as captured content.');
  process.exit(1);
}
console.log('\nOK: only the iframe that loaded was sent.');
