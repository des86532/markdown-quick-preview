// Zips the built extension for upload (e.g. Chrome Web Store).
// Run after `vite build`; reads the version from dist/manifest.json.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
const releaseDir = 'release';
const zipPath = join(releaseDir, `markdown-quick-preview-${manifest.version}.zip`);

mkdirSync(releaseDir, { recursive: true });
// `zip` merges into an existing archive, so remove the old file first.
rmSync(zipPath, { force: true });
// Zip the contents of dist/ (not the folder itself): manifest.json must sit at the archive root.
execFileSync('zip', ['-qr', resolve(zipPath), '.'], { cwd: 'dist', stdio: 'inherit' });
console.log(`Packaged ${zipPath}`);
