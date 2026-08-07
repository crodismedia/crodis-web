export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') return response.status(405).json({ error: 'Método no permitido' });

  const query = String(request.query?.q || '').trim().slice(0, 180);
  if (query.length < 2) return response.status(400).json({ error: 'Escribe al menos 2 caracteres' });

  const auth = String(request.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const supabaseUrl = process.env.SUPABASE_URL || 'https://cnyptelvbsndpkzbrete.supabase.co';
  const anon = process.env.SUPABASE_ANON_KEY || 'sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh';
  if (!token) return response.status(401).json({ error: 'Sesión administrativa no disponible' });

  try {
    const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/es_administrador`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });
    const admin = rpc.ok ? await rpc.json() : false;
    if (admin !== true) return response.status(403).json({ error: 'Acceso no autorizado' });

    const braveKey = process.env.BRAVE_SEARCH_API_KEY || '';
    if (braveKey) {
      const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&country=es&search_lang=es`, {
        headers: { Accept: 'application/json', 'X-Subscription-Token': braveKey }
      });
      if (r.ok) {
        const data = await r.json();
        const resultados = (data.web?.results || []).slice(0, 10).map(x => ({
          titulo: x.title || x.url,
          url: x.url,
          descripcion: x.description || ''
        }));
        if (resultados.length) return response.status(200).json({ query, fuente: 'brave', resultados });
      }
    }

    const limpiar = s => String(s || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

    const fuentes = [
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
    ];

    for (const fuente of fuentes) {
      try {
        const r = await fetch(fuente, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TallerMap/1.0; +https://www.tallermap.es)',
            'Accept-Language': 'es-ES,es;q=0.9'
          }
        });
        if (!r.ok) continue;
        const html = await r.text();
        const resultados = [];

        const reHtml = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
        let m;
        while ((m = reHtml.exec(html)) && resultados.length < 10) {
          let url = m[1].replace(/&amp;/g, '&');
          try {
            const u = new URL(url, 'https://duckduckgo.com');
            const uddg = u.searchParams.get('uddg');
            if (uddg) url = decodeURIComponent(uddg);
          } catch (_) {}
          if (!/^https?:\/\//i.test(url)) continue;
          resultados.push({ titulo: limpiar(m[2]) || url, url, descripcion: limpiar(m[3]) });
        }

        if (!resultados.length) {
          const reLite = /<a[^>]+href="([^"]+)"[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/gi;
          while ((m = reLite.exec(html)) && resultados.length < 10) {
            let url = m[1].replace(/&amp;/g, '&');
            try {
              const u = new URL(url, 'https://duckduckgo.com');
              const uddg = u.searchParams.get('uddg');
              if (uddg) url = decodeURIComponent(uddg);
            } catch (_) {}
            if (!/^https?:\/\//i.test(url)) continue;
            resultados.push({ titulo: limpiar(m[2]) || url, url, descripcion: '' });
          }
        }

        if (resultados.length) return response.status(200).json({ query, fuente: 'duckduckgo', resultados });
      } catch (_) {}
    }

    return response.status(200).json({ query, fuente: 'sin-resultados', resultados: [] });
  } catch (error) {
    console.error('busqueda-web', error);
    return response.status(502).json({ error: 'No se pudo completar la búsqueda web' });
  }
}
