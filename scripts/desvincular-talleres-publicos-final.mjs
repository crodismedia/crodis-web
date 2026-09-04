import fs from 'node:fs';

const removeFiles = [
  'api/guardian.js',
  'quality-guard.cjs',
  'api/taller-path-legacy.js'
];

for (const file of removeFiles) {
  if (fs.existsSync(file)) fs.rmSync(file, { force: true });
}

const vercelPath = 'vercel.json';
const vercel = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));

if (vercel.functions) {
  delete vercel.functions['api/guardian.js'];
  if (Object.keys(vercel.functions).length === 0) delete vercel.functions;
}

if (Array.isArray(vercel.rewrites)) {
  vercel.rewrites = vercel.rewrites.filter(rule => {
    const source = String(rule?.source || '');
    const destination = String(rule?.destination || '');
    return source !== '/taller/:legacy' && !destination.includes('/api/taller-path-legacy');
  });
}

fs.writeFileSync(vercelPath, JSON.stringify(vercel, null, 2) + '\n', 'utf8');

const forbidden = [
  'taller-public', 'taller-html', 'home-cache-fix', 'crearTarjeta',
  'home-public.js', 'busqueda-url.js', 'provincia-public', 'servicio-public',
  'api/guardian.js', 'quality-guard.cjs', 'taller-path-legacy'
];

const currentVercel = fs.readFileSync(vercelPath, 'utf8');
for (const term of forbidden) {
  if (currentVercel.includes(term)) throw new Error(`vercel.json todavía contiene: ${term}`);
}

console.log('OK: stack público de talleres desvinculado de constructores, APIs legacy y Quality Guard.');