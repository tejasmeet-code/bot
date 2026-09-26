// Entry point that runs the compiled application directly
console.log('⚡ Starting Relosta Bot service...');
import('./artifacts/api-server/dist/index.mjs').catch((err) => {
  console.error('❌ Failed to launch application:', err);
  process.exit(1);
});
