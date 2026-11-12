# percy-webdriverio-repro

Reproductions for two problems in `@percy/webdriverio` with WebdriverIO 10.

| Package | Version |
|---|---|
| `@percy/webdriverio` | 3.3.5-beta.0 (npm `latest`) |
| `@percy/sdk-utils`, `@percy/dom`, `@percy/cli` | 1.32.12 |
| `webdriverio` | 10.2.0 |
| `typescript` | 6.0.3 |

```sh
npm install
```

The [Repro workflow](.github/workflows/repro.yml) runs each reproduction in its own job.
A red job means that the bug is present. The jobs marked "control" stay green.

## 1. Chrome: a failed cross-origin iframe is sent as Chrome's error page

When a cross-origin iframe does not load, Chrome gives its document the URL
`chrome-error://chromewebdata/`. The SDK does not skip this URL, so it sends Chrome's
"This site can't be reached" page to Percy as captured iframe content.
Firefox gives `about:neterror`, which the SDK skips.

```sh
npm run repro:iframe:chrome          # Chrome, BiDi session: fails
npm run repro:iframe:chrome-classic  # Chrome, Classic session: fails
npm run repro:iframe:firefox         # Firefox, BiDi session (control): passes
```

[`iframe/run.mjs`](iframe/run.mjs) opens a page with two cross-origin iframes: one loads,
one points to a closed port. A small local server takes the place of the Percy CLI and
records the snapshot body that the SDK sends, so no Percy token is necessary.

Result in Chrome 157:

```text
corsIframes sent to Percy: 2
- frameUrl: http://localhost:<port>/frame
  text:     ok frame Cross-origin frame that loaded
- frameUrl: chrome-error://chromewebdata/
  text:     localhost This site can’t be reached localhost refused to connect. Try: Checking the connection ...

BUG: the browser error page of the failed iframe was sent as captured content.
```

Cause: `UNSUPPORTED_IFRAME_SRCS` in `@percy/sdk-utils` has `chrome:`, but
`chrome-error://…` does not start with `chrome:`. The SDK uses `isUnsupportedIframeSrc`
from `@percy/sdk-utils` before the copy in its own `_iframe_shim.js`. With
`'chrome-error:'` added to the `@percy/sdk-utils` list, only the iframe that loaded is sent.

## 2. TypeScript, `NodeNext` (ESM): `percySnapshot` is not callable

`types/index.d.ts` uses `export default`, but `index.js` sets `module.exports` to the
function. In an ESM project with `moduleResolution: "nodenext"`, the README usage does
not compile:

```sh
npm run repro:types:nodenext   # fails
npm run repro:types:runtime    # fails
npm run repro:types:bundler    # control (create-wdio default): passes
```

```text
types/spec.ts(6,7): error TS2349: This expression is not callable.
  Type 'typeof import(".../node_modules/@percy/webdriverio/types/index")' has no call signatures.
```

TypeScript then accepts `percySnapshot.default(...)`, but at runtime that property does not exist:

```text
typeof percySnapshot         : function
typeof percySnapshot.default : undefined
```

Thus, an ESM TypeScript project with `NodeNext` has no way to call `percySnapshot` that
both compiles and runs. With `export = percySnapshot` in `types/index.d.ts`, both the
`NodeNext` and the `bundler` checks pass.
