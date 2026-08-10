import { rewrite } from '@vercel/functions';

const SERVICE_SLUGS = new Set([
  'mecanica-general',
  'neumaticos',
  'chapa-pintura',
  'diagnosis-electronica',
  'aire-acondicionado',
  'hibridos-electricos'
]);

export default function middleware(request) {
  const incoming = new URL(request.url);
  const pathname = incoming.pathname;

  if (pathname === '/') {
    const target = new URL('/api/home', request.url);
    target.search = incoming.search;
    return rewrite(target);
  }

  const provinceMatch = pathname.match(/^\/provincias\/([a-z0-9-]+)\.html$/i);
  if (provinceMatch) {
    const target = new URL('/api/provincia', request.url);
    target.search = incoming.search;
    target.searchParams.set('provincia', provinceMatch[1]);
    return rewrite(target);
  }

  const municipalityMatch = pathname.match(/^\/municipios\/([^/]+\.html)$/i);
  if (municipalityMatch) {
    const target = new URL('/api/municipio', request.url);
    target.search = incoming.search;
    target.searchParams.set('archivo', municipalityMatch[1]);
    return rewrite(target);
  }

  const serviceMatch = pathname.match(/^\/servicios\/([a-z0-9-]+)\.html$/i);
  if (serviceMatch && SERVICE_SLUGS.has(serviceMatch[1].toLowerCase())) {
    const target = new URL('/api/servicio', request.url);
    target.search = incoming.search;
    target.searchParams.set('servicio', serviceMatch[1].toLowerCase());
    return rewrite(target);
  }
}

export const config = {
  matcher: [
    '/',
    '/provincias/:path*.html',
    '/municipios/:path*.html',
    '/servicios/:path*.html'
  ]
};
