// TypeScript (NodeNext) rejects `percySnapshot(...)` and accepts
// `percySnapshot.default(...)`. This shows what Node gives at runtime.
import percySnapshot from '@percy/webdriverio';

console.log('typeof percySnapshot         :', typeof percySnapshot);
console.log('typeof percySnapshot.default :', typeof percySnapshot.default);
if (typeof percySnapshot.default !== 'function') {
  console.log('\nBUG: the call that TypeScript accepts, percySnapshot.default(...), throws a TypeError at runtime.');
  process.exit(1);
}
