// Empaqueta los archivos estáticos en ./www para compilar el APK con Capacitor.
// Uso: npm run build:www
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');

if (existsSync(www)) rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

for (const item of ['index.html', 'manifest.json', 'sw.js', 'css', 'js', 'icons', 'assets', 'boda']) {
  if (existsSync(join(root, item))) {
    cpSync(join(root, item), join(www, item), { recursive: true });
  }
}
console.log('Carpeta www/ generada y lista para Capacitor ✔');
