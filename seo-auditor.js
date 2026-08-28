#!/usr/bin/env node

/**
 * SEO AUDITOR - Auditoría completa para TallerMap.es
 * Específicamente adaptado para https://www.tallermap.es
 * 
 * Uso:
 *   node seo-auditor.js                          # Auditoría local
 *   node seo-auditor.js --prod                   # Audita https://www.tallermap.es
 *   node seo-auditor.js --full                   # Análisis completo
 *   node seo-auditor.js --compare                # Compara con competidores
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// ============ CONFIGURACIÓN ESPECÍFICA PARA TALLERMAP.ES ============
const CONFIG = {
  // URL objetivo
  targetUrl: 'https://www.tallermap.es',
  
  // Palabras clave principales de TallerMap
  keywords: [
    'taller mecánico',
    'talleres',
    'mecánica',
    'automóvil',
    'coche',
    'reparación',
    'mantenimiento',
    'taller cerca de mí',
    'mapa talleres',
    'directorio talleres'
  ],
  
  // Competidores para comparar
  competitors: [
    'https://www.talleressolidarios.es',
    'https://www.autocasion.com',
    'https://www.talleresmecanicos.es'
  ],
  
  // Verificaciones críticas para Google
  google: {
    requiredMetaTags: ['title', 'description', 'viewport', 'robots'],
    recommendedMetaTags: ['author', 'keywords', 'canonical', 'og:title', 'og:description', 'og:image', 'twitter:card'],
    maxTitleLength: 60,
    minTitleLength: 30,
    maxDescriptionLength: 160,
    minDescriptionLength: 70,
    checkStructuredData: true,
    checkSitemap: true,
    checkRobotsTxt: true,
    // Específico para directorio de talleres
    checkLocalBusiness: true
  },
  
  // Umbrales de rendimiento
  performance: {
    maxLoadTime: 3000,
    maxFirstPaint: 1800,
    maxTotalSize: 5000000,
    maxImagesWithoutAlt: 0,
    maxBrokenLinks: 0
  },
  
  // Estructura de contenido
  content: {
    minWordsPerPage: 300,
    checkHeadings: true,
    checkInternalLinks: true,
    checkExternalLinks: true,
    maxExternalLinksPerPage: 50,
    // Específico para TallerMap
    checkLocationContent: true,
    checkCategoriesContent: true
  },
  
  // Ignorar rutas
  ignore: [
    'node_modules/**',
    '.next/**',
    'out/**',
    'dist/**',
    'build/**',
    '.vercel/**',
    '*.min.js',
    '*.min.css'
  ]
};

// ============ UTILIDADES ============
class SEOAuditor {
  constructor(options = {}) {
    this.options = options;
    this.url = options.prod ? CONFIG.targetUrl : (options.url || 'http://localhost:3000');
    this.results = {
      url: this.url,
      timestamp: new Date().toISOString(),
      score: 100,
      checks: { passed: 0, failed: 0, warnings: 0, total: 0 },
      issues: [],
      recommendations: [],
      metadata: {},
      performance: {},
      content: {},
      links: {},
      structuredData: [],
      localBusiness: {},
      keywordAnalysis: {}
    };
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      highlight: '\x1b[35m',
      seo: '\x1b[34m',
      local: '\x1b[32m',
      reset: '\x1b[0m'
    };
    const prefix = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      highlight: '🔍',
      seo: '🔎',
      local: '📍'
    };
    console.log(`${colors[type]}${prefix[type] || ''} ${message}${colors.reset}`);
  }

  addIssue(type, message, severity = 'warning', element = null) {
    this.results.issues.push({
      type,
      severity,
      message,
      element,
      timestamp: new Date().toISOString()
    });
    
    if (severity === 'error') {
      this.results.checks.failed++;
      this.results.score -= 3;
    } else if (severity === 'warning') {
      this.results.checks.warnings++;
      this.results.score -= 1;
    } else {
      this.results.checks.passed++;
    }
    this.results.checks.total++;
  }

  addRecommendation(message, priority = 'high', details = null) {
    this.results.recommendations.push({
      message,
      priority,
      details,
      timestamp: new Date().toISOString()
    });
  }

  fetchHTML(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : require('http');
      const req = protocol.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            html: data,
            statusCode: res.statusCode,
            headers: res.headers,
            url: res.url || url
          });
        });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Timeout fetching URL'));
      });
    });
  }

  analyzeMetadata(html) {
    this.log('📝 Analizando metadatos...', 'seo');
    const metadata = { title: null, description: null, viewport: null, robots: null, canonical: null, openGraph: {}, twitter: {}, keywords: null, author: null };
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
      const titleLength = metadata.title.length;
      const hasKeyword = CONFIG.keywords.some(kw => metadata.title.toLowerCase().includes(kw.toLowerCase()));
      if (!hasKeyword) { this.addIssue('metadata', 'El title no incluye palabras clave principales (taller, mecánico, etc.)', 'warning', 'title'); this.addRecommendation('Incluir palabras clave como "taller mecánico" en el title', 'high'); }
      if (titleLength === 0) { this.addIssue('metadata', 'Title vacío', 'error', 'title'); this.addRecommendation('Agregar un título descriptivo para TallerMap', 'high'); }
      else if (titleLength < CONFIG.google.minTitleLength) { this.addIssue('metadata', `Title muy corto (${titleLength} caracteres)`, 'warning', 'title'); this.addRecommendation(`Ampliar el title a ${CONFIG.google.minTitleLength}-${CONFIG.google.maxTitleLength} caracteres`, 'high'); }
      else if (titleLength > CONFIG.google.maxTitleLength) { this.addIssue('metadata', `Title muy largo (${titleLength} caracteres)`, 'warning', 'title'); this.addRecommendation(`Acortar el title a ${CONFIG.google.minTitleLength}-${CONFIG.google.maxTitleLength} caracteres`, 'medium'); }
      else { this.addIssue('metadata', `✅ Title: "${metadata.title}" (${titleLength} caracteres)`, 'info', 'title'); }
    } else { this.addIssue('metadata', '❌ Tag <title> no encontrado', 'error', 'title'); this.addRecommendation('Agregar <title> a la página (obligatorio para SEO)', 'high'); }
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
    if (descMatch) {
      metadata.description = descMatch[1].trim();
      const descLength = metadata.description.length;
      const hasKeyword = CONFIG.keywords.some(kw => metadata.description.toLowerCase().includes(kw.toLowerCase()));
      if (!hasKeyword) { this.addIssue('metadata', 'La description no incluye palabras clave principales', 'warning', 'description'); this.addRecommendation('Incluir palabras clave en la meta description', 'high'); }
      if (descLength === 0) { this.addIssue('metadata', 'Meta description vacío', 'error', 'description'); this.addRecommendation('Agregar meta description descriptivo para TallerMap', 'high'); }
      else if (descLength < CONFIG.google.minDescriptionLength) { this.addIssue('metadata', `Description muy corto (${descLength} caracteres)`, 'warning', 'description'); this.addRecommendation(`Ampliar description a ${CONFIG.google.minDescriptionLength}-${CONFIG.google.maxDescriptionLength} caracteres`, 'high'); }
      else if (descLength > CONFIG.google.maxDescriptionLength) { this.addIssue('metadata', `Description muy largo (${descLength} caracteres)`, 'warning', 'description'); this.addRecommendation(`Acortar description a ${CONFIG.google.minDescriptionLength}-${CONFIG.google.maxDescriptionLength} caracteres`, 'medium'); }
      else { this.addIssue('metadata', `✅ Description: "${metadata.description}" (${descLength} caracteres)`, 'info', 'description'); }
    } else { this.addIssue('metadata', 'Meta description no encontrado', 'warning', 'description'); this.addRecommendation('Agregar meta description (importante para CTR en búsquedas de talleres)', 'high'); }
    const keywordsMatch = html.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']*)["']/i);
    if (keywordsMatch) { metadata.keywords = keywordsMatch[1].trim(); const keywordList = metadata.keywords.split(',').map(k => k.trim()); const missingKeywords = CONFIG.keywords.filter(kw => !keywordList.some(k => k.toLowerCase().includes(kw.toLowerCase()))); if (missingKeywords.length > 0) { this.addIssue('metadata', `Faltan keywords importantes: ${missingKeywords.slice(0, 3).join(', ')}`, 'info', 'keywords'); this.addRecommendation(`Agregar keywords: ${missingKeywords.slice(0, 3).join(', ')}`, 'medium'); } }
    const robotsMatch = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i);
    if (robotsMatch) { metadata.robots = robotsMatch[1].trim(); if (metadata.robots.includes('noindex')) { this.addIssue('metadata', '⚠️ La página tiene noindex - No será indexada por Google', 'error', 'robots'); this.addRecommendation('Eliminar noindex para permitir indexación en Google', 'high'); } else if (metadata.robots.includes('nofollow')) { this.addIssue('metadata', 'La página tiene nofollow', 'warning', 'robots'); this.addRecommendation('Considerar eliminar nofollow en páginas importantes', 'medium'); } else { this.addIssue('metadata', `✅ Robots: "${metadata.robots}"`, 'info', 'robots'); } } else { this.addIssue('metadata', 'Meta robots no definido (por defecto: index, follow)', 'info', 'robots'); }
    const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i);
    if (canonicalMatch) { metadata.canonical = canonicalMatch[1].trim(); if (!metadata.canonical.includes('tallermap.es')) this.addIssue('metadata', 'Canonical no apunta a tallermap.es', 'warning', 'canonical'); else this.addIssue('metadata', `✅ Canonical: ${metadata.canonical}`, 'info', 'canonical'); }
    else { this.addIssue('metadata', 'No se encontró tag canonical', 'warning', 'canonical'); this.addRecommendation('Agregar tag canonical para evitar contenido duplicado', 'medium'); }
    this.results.metadata = metadata; return metadata;
  }

  analyzeLocalBusiness(html) {
    this.log('📍 Analizando contenido local (talleres)...', 'local');
    const localContent = { hasLocationInfo: false, hasPhoneNumber: false, hasAddress: false, hasWorkingHours: false, hasMap: false, locationMentions: [], cityMentions: [] };
    const locationPatterns = [/dirección|address|ubicación|localización/i, /teléfono|phone|móvil|movil/i, /horario|horas|opening|working/i, /mapa|map|google maps/i];
    const textContent = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    locationPatterns.forEach(pattern => { if (pattern.test(textContent)) { if (pattern.toString().includes('dirección|address')) localContent.hasAddress = true; if (pattern.toString().includes('teléfono|phone')) localContent.hasPhoneNumber = true; if (pattern.toString().includes('horario|horas')) localContent.hasWorkingHours = true; if (pattern.toString().includes('mapa|map')) localContent.hasMap = true; } });
    const cities = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Bilbao', 'Alicante'];
    cities.forEach(city => { if (textContent.includes(city)) localContent.cityMentions.push(city); });
    if (!localContent.hasAddress) { this.addIssue('local', 'No se encontró información de dirección', 'warning', 'local'); this.addRecommendation('Agregar información de dirección para SEO local', 'high'); }
    if (!localContent.hasPhoneNumber) { this.addIssue('local', 'No se encontró número de teléfono', 'warning', 'local'); this.addRecommendation('Agregar número de teléfono para contacto y SEO local', 'high'); }
    if (localContent.cityMentions.length === 0) { this.addIssue('local', 'No se mencionan ciudades en el contenido', 'warning', 'local'); this.addRecommendation('Mencionar las ciudades donde operan los talleres', 'medium'); } else this.addIssue('local', `✅ Ciudades mencionadas: ${localContent.cityMentions.join(', ')}`, 'info', 'local');
    this.results.localBusiness = localContent; return localContent;
  }

  analyzeStructure(html) {
    this.log('🏗️ Analizando estructura...', 'seo');
    const structure = { headings: [], images: [], links: { internal: [], external: [], broken: [] }, paragraphs: 0, words: 0, hasMainTag: false, hasHeaderTag: false, hasFooterTag: false, hasArticleTag: false, hasSectionTag: false };
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi; let headingMatch; let h1Count = 0;
    while ((headingMatch = headingRegex.exec(html)) !== null) { const level = headingMatch[1]; const content = headingMatch[2].trim(); structure.headings.push({ level, content }); if (level === '1') h1Count++; }
    if (h1Count === 0) { this.addIssue('structure', 'No hay H1 en la página', 'error', 'h1'); this.addRecommendation('Agregar un H1 con el tema principal (ej: "Directorio de Talleres Mecánicos")', 'high'); }
    else if (h1Count > 1) { this.addIssue('structure', `Múltiples H1 (${h1Count})`, 'warning', 'h1'); this.addRecommendation('Usar solo un H1 principal', 'medium'); }
    else { const h1Content = structure.headings.find(h => h.level === '1')?.content || ''; if (!CONFIG.keywords.some(kw => h1Content.toLowerCase().includes(kw.toLowerCase()))) { this.addIssue('structure', 'El H1 no incluye palabras clave principales', 'warning', 'h1'); this.addRecommendation('Incluir "talleres" o "mecánicos" en el H1', 'high'); } }
    const textContent = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = textContent.split(/\s+/).filter(w => w.length > 1); structure.words = words.length;
    if (structure.words < CONFIG.content.minWordsPerPage) { this.addIssue('content', `Poco contenido (${structure.words} palabras, mínimo ${CONFIG.content.minWordsPerPage})`, 'warning', 'content'); this.addRecommendation(`Aumentar el contenido a ${CONFIG.content.minWordsPerPage}+ palabras`, 'high'); }
    if (/<main[^>]*>/i.test(html)) structure.hasMainTag = true; if (/<header[^>]*>/i.test(html)) structure.hasHeaderTag = true; if (/<footer[^>]*>/i.test(html)) structure.hasFooterTag = true; if (/<section[^>]*>/i.test(html)) structure.hasSectionTag = true;
    if (!structure.hasSectionTag) this.addIssue('structure', 'Falta etiqueta <section> (recomendada para listados de talleres)', 'info', 'semantic');
    this.results.content = structure; return structure;
  }

  analyzeImages(html) {
    this.log('🖼️ Analizando imágenes...', 'seo');
    const imgRegex = /<img\s+([^>]*?)>/gi; let imgMatch; const images = []; let imagesWithoutAlt = 0;
    while ((imgMatch = imgRegex.exec(html)) !== null) { const attrs = imgMatch[1]; const srcMatch = attrs.match(/src\s*=\s*["']([^"']*)["']/i); const altMatch = attrs.match(/alt\s*=\s*["']([^"']*)["']/i); const image = { src: srcMatch ? srcMatch[1] : 'unknown', alt: altMatch ? altMatch[1] : null, hasAlt: !!altMatch }; images.push(image); if (!image.hasAlt) { imagesWithoutAlt++; this.addIssue('images', `Imagen sin alt: ${image.src.substring(0, 50)}`, 'error', 'img'); this.addRecommendation(`Agregar alt a la imagen: ${image.src.substring(0, 50)}`, 'high'); } else if (image.alt === '') this.addIssue('images', `Alt vacío en imagen: ${image.src.substring(0, 50)}`, 'warning', 'img'); }
    if (imagesWithoutAlt > CONFIG.performance.maxImagesWithoutAlt) this.addIssue('images', `${imagesWithoutAlt} imágenes sin alt`, 'error', 'summary');
    this.results.images = { total: images.length, withoutAlt: imagesWithoutAlt, images }; return images;
  }

  analyzeLinks(html) {
    this.log('🔗 Analizando enlaces...', 'seo');
    const linkRegex = /<a\s+([^>]*?)>/gi; let linkMatch; const links = { internal: [], external: [], total: 0, nofollow: 0, dofollow: 0, toTalleres: 0 }; const domain = 'tallermap.es';
    while ((linkMatch = linkRegex.exec(html)) !== null) { const attrs = linkMatch[1]; const hrefMatch = attrs.match(/href\s*=\s*["']([^"']*)["']/i); if (!hrefMatch) continue; const href = hrefMatch[1]; const relMatch = attrs.match(/rel\s*=\s*["']([^"']*)["']/i); const rel = relMatch ? relMatch[1] : ''; const isNoFollow = rel.includes('nofollow'); if (href.includes('/taller') || href.includes('/shop') || href.includes('/garage')) links.toTalleres++; try { const url = new URL(href, this.url); if (url.hostname.includes(domain) || href.startsWith('/') || href.startsWith('#')) links.internal.push(href); else links.external.push(href); } catch (e) { if (href.startsWith('/') || href.startsWith('#')) links.internal.push(href); else links.external.push(href); } links.total++; if (isNoFollow) links.nofollow++; else links.dofollow++; }
    if (links.toTalleres === 0) { this.addIssue('links', 'No hay enlaces a talleres en la página', 'warning', 'links'); this.addRecommendation('Agregar enlaces a los talleres listados', 'high'); }
    this.results.links = links; return links;
  }

  analyzeStructuredData(html) {
    this.log('📊 Analizando datos estructurados...', 'seo');
    const structuredData = []; const ldJsonRegex = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi; let jsonMatch;
    while ((jsonMatch = ldJsonRegex.exec(html)) !== null) { try { const data = JSON.parse(jsonMatch[1]); const type = data['@type'] || data['@graph']?.[0]?.['@type'] || 'unknown'; structuredData.push({ type, data, isValid: true, error: null }); if (type === 'LocalBusiness' || type === 'AutomotiveBusiness') this.addIssue('structured', '✅ Schema LocalBusiness encontrado (crucial para talleres)', 'success', 'structured'); } catch (e) { structuredData.push({ type: 'invalid', data: null, isValid: false, error: e.message }); } }
    if (structuredData.length === 0) { this.addIssue('structured', 'No se encontraron datos estructurados (JSON-LD)', 'error', 'structured'); this.addRecommendation('Agregar JSON-LD con Schema.org LocalBusiness o AutomotiveBusiness', 'high'); }
    else { const hasLocalBusiness = structuredData.some(sd => sd.type === 'LocalBusiness' || sd.type === 'AutomotiveBusiness'); if (!hasLocalBusiness) { this.addIssue('structured', 'Falta Schema LocalBusiness (recomendado para directorio de talleres)', 'warning', 'structured'); this.addRecommendation('Agregar Schema LocalBusiness para mejorar el SEO local', 'high'); } }
    this.results.structuredData = structuredData; return structuredData;
  }

  analyzeKeywords(html) {
    this.log('🔑 Analizando palabras clave...', 'seo');
    const textContent = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').toLowerCase(); const keywordAnalysis = {}; const words = textContent.split(/\s+/);
    CONFIG.keywords.forEach(keyword => { const count = textContent.split(keyword.toLowerCase()).length - 1; keywordAnalysis[keyword] = { count, density: (count / words.length * 100).toFixed(2), status: count >= 3 ? 'good' : count >= 1 ? 'ok' : 'missing' }; });
    const missingKeywords = Object.entries(keywordAnalysis).filter(([_, data]) => data.status === 'missing').map(([keyword]) => keyword); if (missingKeywords.length > 0) { this.addIssue('keywords', `Faltan palabras clave: ${missingKeywords.slice(0, 3).join(', ')}`, 'warning', 'keywords'); this.addRecommendation(`Incluir palabras clave: ${missingKeywords.slice(0, 3).join(', ')}`, 'medium'); }
    const highDensity = Object.entries(keywordAnalysis).filter(([_, data]) => parseFloat(data.density) > 3).map(([keyword]) => keyword); if (highDensity.length > 0) { this.addIssue('keywords', `Posible keyword stuffing: ${highDensity.slice(0, 3).join(', ')}`, 'warning', 'keywords'); this.addRecommendation(`Reducir la densidad de: ${highDensity.slice(0, 3).join(', ')}`, 'medium'); }
    this.results.keywordAnalysis = keywordAnalysis; return keywordAnalysis;
  }

  async audit() {
    this.log('\n🔎 AUDITORÍA SEO PARA TALLERMAP.ES', 'highlight'); this.log('============================================\n'); this.log(`📌 URL analizada: ${this.url}`, 'seo'); this.log(`⏱️ Fecha: ${new Date().toISOString()}\n`, 'info');
    try { this.log('🌐 Obteniendo contenido...', 'info'); const { html, statusCode, headers } = await this.fetchHTML(this.url); if (statusCode !== 200) { this.addIssue('general', `HTTP Status ${statusCode} - La página no está accesible`, 'error', 'status'); this.log(`❌ Error: Status code ${statusCode}`, 'error'); this.results.score = 0; this.generateReport(); return this.results; }
      this.log(`✅ Página accesible (Status ${statusCode})`, 'success'); this.analyzeMetadata(html); this.analyzeImages(html); this.analyzeStructure(html); this.analyzeLinks(html); this.analyzeStructuredData(html); this.analyzeLocalBusiness(html); this.analyzeKeywords(html); this.results.score = Math.max(0, Math.round(this.results.score)); this.results.duration = Date.now() - this.startTime; this.generateFinalRecommendations(); this.generateReport(); return this.results;
    } catch (error) { this.log(`❌ Error en auditoría: ${error.message}`, 'error'); this.addIssue('general', `Error: ${error.message}`, 'error'); this.generateReport(); return this.results; }
  }

  generateFinalRecommendations() {
    const recommendations = []; const criticalIssues = this.results.issues.filter(i => i.severity === 'error');
    if (criticalIssues.length > 0) recommendations.push({ priority: 'CRÍTICO', message: `Corregir ${criticalIssues.length} errores críticos de SEO`, details: criticalIssues.map(i => `- ${i.message}`).join('\n') });
    if (this.results.localBusiness && !this.results.localBusiness.hasAddress) recommendations.push({ priority: 'ALTO', message: 'Agregar dirección física para SEO local', details: 'Incluir dirección, ciudad y código postal para mejorar el SEO local de los talleres' });
    if (this.results.images && this.results.images.withoutAlt > 0) recommendations.push({ priority: 'ALTO', message: `Agregar alt a ${this.results.images.withoutAlt} imágenes`, details: 'Importante para accesibilidad y SEO de imágenes de talleres' });
    if (this.results.structuredData && this.results.structuredData.length === 0) recommendations.push({ priority: 'ALTO', message: 'Implementar Schema.org LocalBusiness', details: 'Mejora los rich snippets en búsquedas de talleres mecánicos' });
    this.results.recommendations = recommendations;
  }

  generateReport() {
    const reportDir = './seo-reports'; fs.mkdirSync(reportDir, { recursive: true }); const jsonPath = path.join(reportDir, `seo-report-tallermap-${Date.now()}.json`); fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2)); this.log(`📄 Reporte JSON: ${jsonPath}`, 'success'); this.generateHTMLReport(reportDir); this.generateMarkdownReport(reportDir); this.showSummary();
  }

  generateHTMLReport(reportDir) {
    const grade = this.results.score >= 90 ? 'A' : this.results.score >= 80 ? 'B' : this.results.score >= 70 ? 'C' : this.results.score >= 60 ? 'D' : 'F';
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>SEO Auditor - TallerMap.es</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f7fa;padding:20px;color:#2d3748}.container{max-width:1200px;margin:0 auto}.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:30px;border-radius:10px;margin-bottom:30px}.score-card,.section{background:#fff;border-radius:10px;padding:20px;box-shadow:0 2px 4px rgba(0,0,0,.1);margin-bottom:20px}.score-card{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:20px}.score-item{text-align:center;padding:15px;background:#f7fafc;border-radius:8px}.number{font-size:2.5em;font-weight:bold}.issue{padding:12px;border-left:4px solid #e2e8f0;margin-bottom:10px;background:#f7fafc;border-radius:4px}.issue.error{border-left-color:#fc8181}.issue.warning{border-left-color:#f6ad55}.issue.info{border-left-color:#63b3ed}.issue.success{border-left-color:#48bb78}.metadata-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.metadata-item{padding:10px;background:#f7fafc;border-radius:4px}.keyword-tag{display:inline-block;padding:4px 10px;border-radius:20px;font-size:.8em;margin:3px}.good{background:#c6f6d5}.ok{background:#fefcbf}.missing{background:#fed7d7}@media(max-width:768px){.metadata-grid{grid-template-columns:1fr}}</style></head><body><div class="container"><div class="header"><h1>🔎 SEO Auditor - TallerMap.es</h1><p>${this.results.url}</p><div>Generado: ${new Date(this.results.timestamp).toLocaleString()} | Duración: ${(this.results.duration / 1000).toFixed(2)}s</div></div><div class="score-card"><div class="score-item"><div class="number">${this.results.score}</div><div>Score SEO (${grade})</div></div><div class="score-item"><div class="number">${this.results.checks.passed}</div><div>✅ Pasaron</div></div><div class="score-item"><div class="number">${this.results.checks.warnings}</div><div>⚠️ Advertencias</div></div><div class="score-item"><div class="number">${this.results.checks.failed}</div><div>❌ Fallaron</div></div></div><div class="section"><h2>📝 Metadatos</h2><div class="metadata-grid"><div class="metadata-item"><b>Title</b><div>${this.results.metadata.title || 'No definido'}</div></div><div class="metadata-item"><b>Description</b><div>${this.results.metadata.description || 'No definido'}</div></div><div class="metadata-item"><b>Robots</b><div>${this.results.metadata.robots || 'Por defecto (index, follow)'}</div></div><div class="metadata-item"><b>Canonical</b><div>${this.results.metadata.canonical || 'No definido'}</div></div></div></div><div class="section"><h2>📍 SEO Local</h2><p>Dirección: ${this.results.localBusiness?.hasAddress ? '✅' : '❌'}</p><p>Teléfono: ${this.results.localBusiness?.hasPhoneNumber ? '✅' : '❌'}</p><p>Horarios: ${this.results.localBusiness?.hasWorkingHours ? '✅' : '❌'}</p></div><div class="section"><h2>🔑 Palabras Clave</h2>${Object.entries(this.results.keywordAnalysis || {}).map(([keyword,data])=>`<span class="keyword-tag ${data.status}">${keyword}: ${data.count} veces (${data.density}%)</span>`).join('')}</div><div class="section"><h2>🖼️ Imágenes</h2><p>Total: ${this.results.images?.total || 0} | Sin alt: ${this.results.images?.withoutAlt || 0}</p></div><div class="section"><h2>📊 Contenido</h2><p>Palabras: ${this.results.content?.words || 0} | Párrafos: ${this.results.content?.paragraphs || 0}</p></div><div class="section"><h2>🔗 Enlaces</h2><p>Total: ${this.results.links?.total || 0} | Internos: ${this.results.links?.internal?.length || 0} | Externos: ${this.results.links?.external?.length || 0}</p></div><div class="section"><h2>❌ Issues</h2>${this.results.issues.map(issue=>`<div class="issue ${issue.severity}"><b>${issue.severity.toUpperCase()}</b> ${issue.message}</div>`).join('')}</div></div></body></html>`;
    const htmlPath = path.join(reportDir, `seo-report-tallermap-${Date.now()}.html`); fs.writeFileSync(htmlPath, html); this.log(`📄 Reporte HTML: ${htmlPath}`, 'success');
  }

  generateMarkdownReport(reportDir) {
    let md = `# 🔎 SEO Auditor - Reporte para TallerMap.es\n\n## URL: ${this.results.url}\n**Generado:** ${new Date(this.results.timestamp).toLocaleString()}\n**Duración:** ${(this.results.duration / 1000).toFixed(2)}s\n\n---\n\n## 📊 Resumen\n\n| Métrica | Valor |\n|---------|-------|\n| **Score SEO** | **${this.results.score}/100** |\n| Checks pasaron | ${this.results.checks.passed} |\n| Advertencias | ${this.results.checks.warnings} |\n| Fallaron | ${this.results.checks.failed} |\n\n## 📝 Metadatos\n- Title: ${this.results.metadata.title || 'No definido'}\n- Description: ${this.results.metadata.description || 'No definido'}\n- Robots: ${this.results.metadata.robots || 'Por defecto'}\n- Canonical: ${this.results.metadata.canonical || 'No definido'}\n\n## 🖼️ Imágenes\n- Total: ${this.results.images?.total || 0}\n- Sin alt: ${this.results.images?.withoutAlt || 0}\n\n## ❌ Issues\n${this.results.issues.map(issue => `- **${issue.severity.toUpperCase()}** ${issue.message}`).join('\n')}\n\n## 💡 Recomendaciones\n${this.results.recommendations.map(rec => `- **${rec.priority}** ${rec.message}`).join('\n')}\n`;
    const mdPath = path.join(reportDir, `seo-report-tallermap-${Date.now()}.md`); fs.writeFileSync(mdPath, md); this.log(`📄 Reporte Markdown: ${mdPath}`, 'success');
  }

  showSummary() {
    console.log('\n' + '='.repeat(60)); console.log('📊 RESUMEN SEO - TALLERMAP.ES'); console.log('='.repeat(60)); const grade = this.results.score >= 90 ? '🌟 Excelente' : this.results.score >= 80 ? '✅ Bueno' : this.results.score >= 70 ? '⚠️ Aceptable' : this.results.score >= 60 ? '⚠️ Necesita mejora' : '❌ Crítico'; console.log(`\n📈 Score SEO: ${this.results.score}/100 - ${grade}`); console.log(`✅ Checks pasaron: ${this.results.checks.passed}`); console.log(`⚠️ Advertencias: ${this.results.checks.warnings}`); console.log(`❌ Fallaron: ${this.results.checks.failed}`); if (this.results.metadata?.title) console.log(`\n📝 Title: "${this.results.metadata.title}"`); if (this.results.images) console.log(`\n🖼️ Imágenes: ${this.results.images.total} total, ${this.results.images.withoutAlt} sin alt`); if (this.results.localBusiness) { console.log(`\n📍 SEO Local:`); console.log(`   Dirección: ${this.results.localBusiness.hasAddress ? '✅' : '❌'}`); console.log(`   Teléfono: ${this.results.localBusiness.hasPhoneNumber ? '✅' : '❌'}`); console.log(`   Ciudades: ${this.results.localBusiness.cityMentions?.join(', ') || 'Ninguna'}`); } const criticalIssues = this.results.issues.filter(i => i.severity === 'error'); if (criticalIssues.length > 0) { console.log(`\n❌ ${criticalIssues.length} errores críticos encontrados`); criticalIssues.forEach(i => console.log(`   - ${i.message}`)); } console.log('\n' + '='.repeat(60)); console.log(`📄 Reportes generados en: ./seo-reports/`); console.log('='.repeat(60) + '\n');
  }
}

function showHelp() {
  console.log(`\n🔎 SEO AUDITOR - TallerMap.es\n\nUSO:\n  node seo-auditor.js [opciones]\n\nOPCIONES:\n  --help, -h       Muestra esta ayuda\n  --prod, -p       Audita https://www.tallermap.es\n  --full, -f       Análisis completo (recomendado)\n  --verbose, -v    Muestra información detallada\n\nEJEMPLOS:\n  node seo-auditor.js --prod\n  node seo-auditor.js --full --prod\n  node seo-auditor.js --verbose\n\nREPORTES:\n  Los reportes se guardan en ./seo-reports/\n`);
}

async function main() {
  const args = process.argv.slice(2); if (args.includes('--help') || args.includes('-h')) { showHelp(); return; }
  const options = { prod: args.includes('--prod') || args.includes('-p'), full: args.includes('--full') || args.includes('-f'), verbose: args.includes('--verbose') || args.includes('-v') };
  const auditor = new SEOAuditor(options); const results = await auditor.audit();
  if (process.env.CI) { const criticalIssues = results.issues.filter(i => i.severity === 'error'); if (criticalIssues.length > 0 || results.score < 70) { console.error(`❌ Auditoría SEO falló (score: ${results.score})`); process.exit(1); } }
}

if (require.main === module) { main().catch(error => { console.error('❌ Error:', error); process.exit(1); }); }

module.exports = { SEOAuditor };
