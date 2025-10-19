import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function injectVersion() {
  try {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const distIndexPath = path.join(projectRoot, 'dist', 'index.html');

    const pkgRaw = await readFile(packageJsonPath, 'utf8');
    const { version } = JSON.parse(pkgRaw);

    const indexHtml = await readFile(distIndexPath, 'utf8');

    if (!indexHtml.includes('__APP_VERSION__')) {
      console.warn('inject-version: placeholder "__APP_VERSION__" not found in dist/index.html');
      return;
    }

    const updated = indexHtml.replace(/__APP_VERSION__/g, version);
    await writeFile(distIndexPath, updated, 'utf8');
    console.log(`inject-version: injected version ${version} into dist/index.html`);
  } catch (error) {
    console.error('inject-version: failed to inject version', error);
    process.exitCode = 1;
  }
}

injectVersion();
