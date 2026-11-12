import { describe, test } from 'vitest';
import percySnapshot from '@percy/webdriverio';

// With vitestOpts.parallelMode, test.concurrent tests run at the same time,
// each in its own browsing context. Without it, test.concurrent throws, so
// the sequential control uses test.
const run = process.env.REPRO_PARALLEL ? test.concurrent : test;

describe('pages', () => {
  for (const name of ['a', 'b']) {
    run(`snapshots page ${name}`, async () => {
      const page = await browser.url(`${process.env.REPRO_BASE_URL}${name}`);
      await browser.pause(500); // let the iframe load
      await percySnapshot(browser, `${name} via browser`);
      await percySnapshot(page, `${name} via context`);
    });
  }
});
