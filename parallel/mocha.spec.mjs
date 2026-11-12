import { browser } from '@wdio/globals';
import percySnapshot from '@percy/webdriverio';

// With mochaOpts.parallelMode, the two tests run at the same time, each in
// its own browsing context.
for (const name of ['a', 'b']) {
  describe(`page ${name}`, () => {
    it(`snapshots page ${name}`, async () => {
      const page = await browser.url(`${process.env.REPRO_BASE_URL}${name}`);
      await browser.pause(500); // let the iframe load
      await percySnapshot(browser, `${name} via browser`);
      await percySnapshot(page, `${name} via context`);
    });
  });
}
