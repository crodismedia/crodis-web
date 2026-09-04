import fs from 'node:fs';

const removeFiles = [
  'api/provincia-public.js',
  'api/provincia.js',
  'api/servicio-public.js',
  'api/servicio.js',
  'js/provincia.js',
  'js/talleres-locales.js',
  'supabase.js',
  'crodis-web-main/js/supabase.js'
];
for (const file of removeFiles) if (fs.existsSync(file)) fs.rmSync(file, { force: true });

if (fs.existsSync('vercel.json')) {
  const config = JSON.parse(fs.readFileSync('vercel.json','utf8'));
  config.rewrites = (config.rewrites || []).filter(r => ![
    '/api/provincia-public?provincia=alicante',
    '/api/provincia-public?provincia=castellon',
    '/api/provincia-public?provincia=valencia'
  ].includes(r.destination) && r.destination !== '/api/servicio-public?servicio=:servicio');
  fs.writeFileSync('vercel.json', JSON.stringify(config, null, 2) + '\n');
}

for (const page of ['provincias/alicante.html','provincias/castellon.html','provincias/valencia.html']) {
  if (!fs.existsSync(page)) continue;
  let html = fs.readFileSync(page,'utf8');
  html = html
    .replace(/\s*<script[^>]+src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^\"]+"[^>]*><\/script>/gi,'')
    .replace(/\s*<script[^>]+src="(?:\.\.\/|\/)js\/provincia\.js(?:\?[^\"]*)?"[^>]*><\/script>/gi,'');
  fs.writeFileSync(page, html);
}

const vercel = fs.readFileSync('vercel.json','utf8');
if (/provincia-public|servicio-public/.test(vercel)) throw new Error('Quedan rewrites públicos dinámicos de provincia/servicio');
for (const file of removeFiles) if (fs.existsSync(file)) throw new Error(`No se eliminó ${file}`);
if (!fs.existsSync('talleres-temporal')) throw new Error('Falta talleres-temporal');
console.log('OK: eliminados renderizadores públicos restantes de talleres por provincia/servicio y constructores JS obsoletos.');
