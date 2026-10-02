// Preview locally without recording test visits or loading advertising.
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const cli = path.resolve(path.dirname(require.resolve('@11ty/eleventy')), '..', 'cmd.cjs');
const result = spawnSync(process.execPath, [cli, '--serve', ...process.argv.slice(2)], {
  cwd: path.resolve(__dirname, '..'),
  env: {...process.env, FIGADE_PREVIEW: '1'},
  stdio: 'inherit'
});
if (result.error) { console.error(result.error.message); process.exit(1); }
process.exit(result.status === null ? 1 : result.status);
