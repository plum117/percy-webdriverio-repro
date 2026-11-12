// WebdriverIO 10 testrunner config for the parallel-mode reproduction.
//   REPRO_FRAMEWORK=mocha|vitest   (default mocha)
//   REPRO_PARALLEL=contexts        in-worker parallel mode; unset = sequential control
//   REPRO_BROWSER=chrome|firefox   (default chrome)
import { startServers } from './servers.mjs';

const framework = process.env.REPRO_FRAMEWORK || 'mocha';
const parallelMode = process.env.REPRO_PARALLEL || undefined;
const browserName = process.env.REPRO_BROWSER || 'chrome';
const outFile = new URL(`./out/${framework}-${parallelMode || 'sequential'}-${browserName}.json`, import.meta.url);

let stop;

export const config = {
  runner: 'local',
  framework,
  specs: [framework === 'vitest' ? './vitest.spec.mjs' : './mocha.spec.mjs'],
  maxInstances: 1,
  logLevel: 'error',
  reporters: ['spec'],
  displayServerEnabled: false,
  capabilities: [{
    browserName,
    'wdio:experimentalBiDiCommands': true,
    'goog:chromeOptions': { args: ['--headless=new'] },
    'moz:firefoxOptions': { args: ['-headless'] }
  }],
  mochaOpts: { timeout: 60000, parallelMode },
  vitestOpts: { testTimeout: 60000, parallelMode },
  async onPrepare() {
    stop = await startServers(outFile);
  },
  async onComplete() {
    await stop?.();
  }
};
