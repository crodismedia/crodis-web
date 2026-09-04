import fs from 'node:fs';

const removeFiles = [
  'api/taller-public.js',
  'api/taller-html.js',
  'api/home-cache-fix.js',
  'api/home.js',
  'api/inspector-taller.js',
  'js/taller-ui.js',
  'js/home-public.js',
  'js/supabase.js',
  'js/busqueda-url.js',
  'generar-talleres-estaticos.mjs',
  'scripts/sync-static-talleres.mjs',
  'pages/taller.html'
];

for (const file of removeFiles) {
  if (fs.existsSync(file)) fs.rmSync(file, { force: true });
}

if (fs.existsSync('index.html')) {
  let html = fs.readFileSync('index.html', 'utf8');
  const patterns = [
    /\s*<link rel="preconnect" href="https:\/\/cdn\.jsdelivr\.net"[^>]*>/gi,
    /\s*<link rel="preconnect" href="https:\/\/[^\"]+\.supabase\.co"[^>]*>/gi,
    /\s*<script[^>]+src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^\"]+"[^>]*><\/script>/gi,
    /\s*<script[^>]+src="js\/taller-ui\.js(?:\?[^\"]*)?"[^>]*><\/script>/gi,
    /\s*<script[^>]+src="js\/home-public\.js(?:\?[^\"]*)?"[^>]*><\/script>/gi,
    /\s*<script[^>]+src="js\/supabase\.js(?:\?[^\"]*)?"[^>]*><\/script>/gi,
    /\s*<script[^>]+src="js\/busqueda-url\.js(?:\?[^\"]*)?"[^>]*><\/script>/gi
  ];
  for (const pattern of patterns) html = html.replace(pattern, '');
  fs.writeFileSync('index.html', html, 'utf8');
}

if (fs.existsSync('js/admin-editor-v4-preview.js')) {
  let js = fs.readFileSync('js/admin-editor-v4-preview.js', 'utf8');
  js = js.replace(/const url=new URL\('\/api\/taller-public',window\.location\.origin\);[\s\S]*?window\.open\(url\.href,'_blank'\);/g,
    "window.open('/talleres/'+encodeURIComponent(slug),'_blank');");
  fs.writeFileSync('js/admin-editor-v4-preview.js', js, 'utf8');
}

if (fs.existsSync('vercel.json')) {
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  if (config.functions) delete config.functions['api/taller-public.js'];
  config.rewrites = (config.rewrites || []).filter(r => r.destination !== '/api/home-cache-fix');
  config.routes = (config.routes || []).filter(r => r.dest !== '/api/taller-legacy' || r.src !== '/pages/taller\\.html');
  config.rewrites = config.rewrites.filter(r => !(r.source === '/pages/taller.html' && r.destination === '/api/taller-legacy'));
  fs.writeFileSync('vercel.json', JSON.stringify(config, null, 2) + '\n', 'utf8');
}

const forbidden = [
  'api/taller-public.js','api/taller-html.js','api/home-cache-fix.js','api/home.js',
  'js/taller-ui.js','js/home-public.js','js/supabase.js','js/busqueda-url.js'
];
for (const file of forbidden) {
  if (fs.existsSync(file)) throw new Error(`No se eliminó ${file}`);
}

const vercel = fs.readFileSync('vercel.json','utf8');
if (/home-cache-fix|api\/taller-public/.test(vercel)) throw new Error('Quedan rutas dinámicas públicas en vercel.json');
const index = fs.readFileSync('index.html','utf8');
if (/taller-ui\.js|home-public\.js|js\/supabase\.js|busqueda-url\.js|supabase-js@/.test(index)) throw new Error('Quedan constructores públicos en index.html');

console.log('OK: retirado el stack público dinámico de talleres; talleres-temporal no se ha tocado.');
