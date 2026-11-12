// The usage from the README of @percy/webdriverio, in an ESM project.
import { remote } from 'webdriverio';
import percySnapshot from '@percy/webdriverio';

const browser = await remote({ capabilities: { browserName: 'chrome' } });
await percySnapshot(browser, 'Home page');

const page = await browser.url('https://example.com');
await percySnapshot(page, 'Example page');
