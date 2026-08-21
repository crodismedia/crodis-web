import { rewrite } from '@vercel/functions';

const SERVICE_SLUGS = new Set([
  'mecanica-general',
  'neumaticos',
  'chapa-pintura',
  'diagnosis-electronica',
  'aire-acondicionado',
  'hibridos-electricos',
  'frenos',
  'embrague',
  'cambio-aceite-filtros',
  'baterias',
  'suspension-amortiguadores',
  'alineacion-direccion',
  'electricidad-automovil',
  'correa-distribucion',
  'pre-itv',
  'reparacion-motor',
  'caja-cambios',
  'sistema-refrigeracion',
  'escape-catalizador',
  'cadena-distribucion',
  'alternador-motor-arranque',
  'lunas-cristales',
  'carroceria',
  'equilibrado-ruedas',
  'centralitas-electronica',
  'calefaccion-climatizacion'
]);

export default function middleware(request) {
  const incoming = new URL(request.url);
  const pathname = incoming.pathname;

  if (pathname === '/sitemap-desguaces.xml') {
    return rewrite(new URL('/api/sitemap-desguaces', request.url));
  }

  if (pathname === '/') {
    const target = new URL('/api/home-cache-fix', request.url);
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
    '/sitemap-desguaces.xml',
    '/provincias/:path*.html',
    '/servicios/:path*.html'
  ]
};
