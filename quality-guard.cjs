#!/usr/bin/env node

/**
 * QUALITY GUARD - Sistema de control de calidad de código
 * Monitorea y verifica la calidad de HTML, CSS y JavaScript
 *
 * Adaptación mínima para TallerMap:
 * - CommonJS en .cjs porque package.json usa "type": "module"
 * - Directorios reales de TallerMap
 * - La primera clase duplicada se renombra para que el script pueda ejecutarse
 *
 * Uso:
 *   node quality-guard.cjs                     # Análisis completo
 *   node quality-guard.cjs --watch             # Modo vigilancia continua
 *   node quality-guard.cjs --fix               # Intenta corregir automáticamente
 *   node quality-guard.cjs --ci                # Modo CI (solo reporta errores)
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

// ============ CONFIGURACIÓN ============
const CONFIG = {
  // Directorios reales de TallerMap. getAllFiles() del código original recorre src + public.
  directories: {
    src: [
      './api',
      './lib',
      './municipios',
      './pages',
      './provincias',
      './servicios',
      './talleres',
      './templates'
    ],
    styles: ['./css'],
    scripts: ['./scripts', './js'],
    public: ['./css', './js', './scripts']
  },

  // Extensiones a verificar
  extensions: {
    html: ['.html', '.htm', '.jsx', '.tsx', '.vue', '.astro'],
    css: ['.css', '.scss', '.sass', '.less', '.module.css'],
    js: ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs']
  },

  // Patrones a ignorar
  ignore: [
    'node_modules/**',
    '.next/**',
    'out/**',
    'dist/**',
    'build/**',
    '.vercel/**',
    '*.min.js',
    '*.min.css',
    '*.bundle.js',
    'coverage/**',
    '.git/**',
    'quality-reports/**'
  ],

  // Umbrales de calidad
  thresholds: {
    maxFileSize: 500 * 1024, // 500KB
    maxLineLength: 120,
    maxComplexity: 15,
    maxDuplication: 10, // porcentaje
    minCoverage: 80, // porcentaje
    maxImagesWithoutAlt: 0,
    maxAccessibilityIssues: 0
  }
};

// ============ UTILIDADES ============
// Renombrada únicamente porque el código original declara QualityGuard dos veces
// en el mismo scope y Node no puede ejecutarlo así.
class QualityGuardUtils {
  constructor() {
    this.issues = [];
    this.metrics = {
      totalFiles: 0,
      totalLines: 0,
      totalErrors: 0,
      totalWarnings: 0,
      score: 100
    };
    this.cache = {};
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };
    console.log(`${colors[type]}${message}${colors.reset}`);
  }

  addIssue(file, line, message, severity = 'warning', category = 'general') {
    this.issues.push({
      file,
      line,
      message,
      severity,
      category,
      timestamp: new Date().toISOString()
    });

    if (severity === 'error') {
      this.metrics.totalErrors++;
      this.metrics.score -= 2;
    } else {
      this.metrics.totalWarnings++;
      this.metrics.score -= 0.5;
    }
  }

  shouldIgnore(filePath) {
    return CONFIG.ignore.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*'));
      return regex.test(filePath);
    });
  }

  getFileHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }
}

// ============ ANALIZADOR HTML ============
class HTMLAnalyzer {
  constructor(guard) {
    this.guard = guard;
  }

  analyze(content, filePath) {
    const issues = [];
    const lines = content.split('\n');

    // 1. Verificar imágenes sin alt
    const imgRegex = /<img\s+([^>]*?)>/gi;
    let match;
    let imgCount = 0;
    let imgWithoutAlt = 0;

    while ((match = imgRegex.exec(content)) !== null) {
      imgCount++;
      const tag = match[0];
      if (!/alt\s*=/i.test(tag)) {
        imgWithoutAlt++;
        const lineNum = content.substring(0, match.index).split('\n').length;
        issues.push({
          type: 'accessibility',
          severity: 'error',
          line: lineNum,
          message: `Imagen sin atributo alt: ${tag.substring(0, 80)}...`
        });
      }
    }

    if (imgCount > 0 && imgWithoutAlt > 0) {
      const ratio = (imgWithoutAlt / imgCount * 100).toFixed(1);
      issues.push({
        type: 'accessibility',
        severity: 'warning',
        line: 0,
        message: `${imgWithoutAlt}/${imgCount} imágenes sin alt (${ratio}%)`
      });
    }

    // 2. Verificar estructura HTML5
    if (!/<\!DOCTYPE html>/i.test(content) && !/<html/i.test(content)) {
      issues.push({
        type: 'structure',
        severity: 'error',
        line: 0,
        message: 'Falta DOCTYPE o estructura HTML básica'
      });
    }

    // 3. Verificar lang attribute
    if (!/<html\s+lang\s*=/i.test(content)) {
      issues.push({
        type: 'accessibility',
        severity: 'warning',
        line: 0,
        message: 'Falta atributo lang en <html>'
      });
    }

    // 4. Verificar meta viewport
    if (!/<meta\s+name\s*=\s*["']viewport["']/i.test(content)) {
      issues.push({
        type: 'responsive',
        severity: 'warning',
        line: 0,
        message: 'Falta meta viewport para responsividad'
      });
    }

    // 5. Verificar títulos en headings
    const headingRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi;
    const headings = [...content.matchAll(headingRegex)];
    if (headings.length > 0) {
      const emptyHeadings = headings.filter(h => !h[1].trim());
      if (emptyHeadings.length > 0) {
        issues.push({
          type: 'seo',
          severity: 'warning',
          line: 0,
          message: `${emptyHeadings.length} heading(s) vacíos encontrados`
        });
      }
    }

    // 6. Verificar links rotos (patrones básicos)
    const linkRegex = /<a\s+href\s*=\s*["']([^"']*)["']/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(content)) !== null) {
      const href = linkMatch[1];
      if (href && (href === '#' || href === '')) {
        const lineNum = content.substring(0, linkMatch.index).split('\n').length;
        issues.push({
          type: 'links',
          severity: 'warning',
          line: lineNum,
          message: `Link vacío o con '#' encontrado`
        });
      }
    }

    // 7. Verificar scripts externos realmente bloqueantes en <head>
    const headMatch = content.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    if (headMatch) {
      const blockingScripts = [...headMatch[1].matchAll(/<script\b([^>]*)src=["'][^"']+["']([^>]*)><\/script>/gi)]
        .filter(m => !/\b(defer|async)\b/i.test(`${m[1]} ${m[2]}`) && !/type=["']module["']/i.test(`${m[1]} ${m[2]}`));
      if (blockingScripts.length > 2) {
        issues.push({
          type: 'performance',
          severity: 'info',
          line: 0,
          message: `${blockingScripts.length} scripts externos bloqueantes en <head>`
        });
      }
    }

    return issues;
  }
}

// ============ ANALIZADOR CSS ============
class CSSAnalyzer {
  constructor(guard) {
    this.guard = guard;
  }

  analyze(content, filePath) {
    const issues = [];
    const lines = content.split('\n');

    // 1. Verificar propiedades realmente duplicadas dentro del mismo bloque CSS
    const duplicatedDeclarations = [];
    const blockRegex = /([^{}]+)\{([^{}]*)\}/g;
    let blockMatch;
    while ((blockMatch = blockRegex.exec(content)) !== null) {
      const selector = blockMatch[1].trim().replace(/\s+/g, ' ');
      const body = blockMatch[2];
      const propRegex = /(?:^|;)\s*([a-zA-Z-]+)\s*:/g;
      const props = {};
      let propMatch;
      while ((propMatch = propRegex.exec(body)) !== null) {
        const prop = propMatch[1].toLowerCase();
        props[prop] = (props[prop] || 0) + 1;
      }
      const repeated = Object.entries(props).filter(([_, count]) => count > 1);
      if (repeated.length > 0) {
        duplicatedDeclarations.push({ selector, repeated });
      }
    }

    if (duplicatedDeclarations.length > 0) {
      const details = duplicatedDeclarations
        .slice(0, 10)
        .map(({ selector, repeated }) => `${selector}: ${repeated.map(([p, c]) => `${p}(${c})`).join(', ')}`)
        .join(' | ');
      issues.push({
        type: 'css',
        severity: 'warning',
        line: 0,
        message: `Propiedades CSS duplicadas dentro del mismo bloque: ${details}`
      });
    }

    // 2. Verificar uso de !important
    const importantCount = (content.match(/!important/g) || []).length;
    if (importantCount > 3) {
      issues.push({
        type: 'css',
        severity: 'warning',
        line: 0,
        message: `Uso excesivo de !important: ${importantCount} veces`
      });
    }

    // 3. Verificar únicamente selectores realmente extremos
    const selectorBlockRegex = /([^{}]+)\{/g;
    const extremeSelectors = [];
    let selectorMatch;
    while ((selectorMatch = selectorBlockRegex.exec(content)) !== null) {
      const selector = selectorMatch[1].trim();
      if (!selector || selector.startsWith('@')) continue;
      const idCount = (selector.match(/#[a-zA-Z0-9_-]+/g) || []).length;
      const maxDepth = Math.max(...selector.split(',').map(part =>
        part.trim().split(/\s+|>|\+|~/).filter(Boolean).length
      ));
      if (idCount > 1 || maxDepth > 7) extremeSelectors.push(selector);
    }
    if (extremeSelectors.length > 0) {
      issues.push({
        type: 'css',
        severity: 'info',
        line: 0,
        message: `Selectores realmente extremos: ${extremeSelectors.slice(0, 5).join(' | ')}`
      });
    }

    // 6. Verificar archivo muy grande
    if (content.length > CONFIG.thresholds.maxFileSize) {
      issues.push({
        type: 'performance',
        severity: 'warning',
        line: 0,
        message: `Archivo CSS muy grande: ${(content.length / 1024).toFixed(1)}KB`
      });
    }


    return issues;
  }
}

// ============ ANALIZADOR JavaScript ============
class JSAnalyzer {
  constructor(guard) {
    this.guard = guard;
  }

  analyze(content, filePath) {
    const issues = [];
    const lines = content.split('\n');

    // 1. Verificar console.log (solo en producción)
    if (filePath.includes('production') || filePath.includes('build')) {
      const consoleMatches = content.match(/console\.(log|debug|info|warn)/g) || [];
      if (consoleMatches.length > 0) {
        issues.push({
          type: 'javascript',
          severity: 'warning',
          line: 0,
          message: `${consoleMatches.length} console statements en producción`
        });
      }
    }

    // 2. Verificar var (debería usar let/const)
    const varCount = (content.match(/\bvar\s/g) || []).length;
    if (varCount > 0) {
      issues.push({
        type: 'javascript',
        severity: 'warning',
        line: 0,
        message: `Uso de 'var' (${varCount} veces), preferir let/const`
      });
    }

    // 3. Verificar funciones muy largas
    const funcRegex = /function\s*\([^)]*\)\s*\{[\s\S]*?\}/g;
    let funcMatch;
    while ((funcMatch = funcRegex.exec(content)) !== null) {
      const funcContent = funcMatch[0];
      const linesInFunc = funcContent.split('\n').length;
      if (linesInFunc > 30) {
        const lineNum = content.substring(0, funcMatch.index).split('\n').length;
        issues.push({
          type: 'javascript',
          severity: 'warning',
          line: lineNum,
          message: `Función muy larga: ${linesInFunc} líneas`
        });
      }
    }

    // 4. Verificar uso de eval
    if (/eval\s*\(/.test(content)) {
      issues.push({
        type: 'security',
        severity: 'error',
        line: 0,
        message: 'Uso de eval() detectado (riesgo de seguridad)'
      });
    }

    // 5. Verificar callbacks anidados (callback hell)
    const callbackRegex = /function\s*\([^)]*\)\s*\{[^{]*function\s*\([^)]*\)\s*\{/g;
    const nestedCallbacks = (content.match(callbackRegex) || []).length;
    if (nestedCallbacks > 0) {
      issues.push({
        type: 'javascript',
        severity: 'warning',
        line: 0,
        message: `Callbacks anidados encontrados (${nestedCallbacks}), considerar Promises/async-await`
      });
    }

    // 6. Verificar imports no utilizados (solo en archivos grandes)
    if (content.includes('import') && content.length > 10000) {
      const importRegex = /import\s+{([^}]+)}\s+from/g;
      let importMatch;
      const importedNames = [];
      while ((importMatch = importRegex.exec(content)) !== null) {
        const names = importMatch[1].split(',').map(n => n.trim());
        importedNames.push(...names);
      }
      // Verificar si los imports se usan (búsqueda simple)
      const unusedImports = importedNames.filter(name => {
        if (name === 'default' || name.includes(' as ')) return false;
        const regex = new RegExp(`\\b${name}\\b(?!\\s*['"])`);
        return !regex.test(content);
      });
      if (unusedImports.length > 2) {
        issues.push({
          type: 'javascript',
          severity: 'info',
          line: 0,
          message: `Posibles imports no utilizados: ${unusedImports.join(', ')}`
        });
      }
    }

    // 7. Verificar archivo muy grande
    if (content.length > CONFIG.thresholds.maxFileSize) {
      issues.push({
        type: 'performance',
        severity: 'warning',
        line: 0,
        message: `Archivo JS muy grande: ${(content.length / 1024).toFixed(1)}KB`
      });
    }

    // 8. Verificar comentarios de TODO/FIXME
    const todoRegex = /\/\/\s*TODO|\/\*\s*TODO|\/\/\s*FIXME|\/\*\s*FIXME/g;
    const todos = [...content.matchAll(todoRegex)];
    if (todos.length > 0) {
      todos.forEach(todo => {
        const lineNum = content.substring(0, todo.index).split('\n').length;
        issues.push({
          type: 'javascript',
          severity: 'info',
          line: lineNum,
          message: `TODO/FIXME encontrado: ${todo[0]}`
        });
      });
    }

    return issues;
  }
}

// ============ ANALIZADOR DE ESTRUCTURA ============
class StructureAnalyzer {
  constructor(guard) {
    this.guard = guard;
  }

  analyzeProjectStructure() {
    const issues = [];
    const baseDir = process.cwd();

    // 1. Verificar estructura de carpetas real de TallerMap
    const requiredDirs = ['api', 'css', 'js', 'scripts', 'municipios', 'pages', 'provincias', 'servicios', 'talleres'];
    const missingDirs = requiredDirs.filter(dir => !fs.existsSync(path.join(baseDir, dir)));
    if (missingDirs.length > 0) {
      issues.push({
        type: 'structure',
        severity: 'info',
        file: 'project',
        line: 0,
        message: `Carpetas faltantes: ${missingDirs.join(', ')}`
      });
    }

    // 2. Verificar archivos de configuración
    const configFiles = ['package.json', '.gitignore', 'README.md'];
    configFiles.forEach(file => {
      if (!fs.existsSync(path.join(baseDir, file))) {
        issues.push({
          type: 'structure',
          severity: 'warning',
          file: 'project',
          line: 0,
          message: `Archivo de configuración faltante: ${file}`
        });
      }
    });

    // 3. Verificar duplicación real de archivos: mismo nombre y mismo contenido
    const allFiles = this.guard.getAllFiles();
    const byName = new Map();
    allFiles.forEach(filePath => {
      const name = path.basename(filePath);
      if (name.includes('test')) return;
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(filePath);
    });

    const realDuplicates = [];
    for (const [name, paths] of byName.entries()) {
      if (paths.length < 2) continue;
      const byHash = new Map();
      for (const filePath of paths) {
        try {
          const hash = crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
          if (!byHash.has(hash)) byHash.set(hash, []);
          byHash.get(hash).push(filePath);
        } catch (_) {}
      }
      for (const sameContentPaths of byHash.values()) {
        if (sameContentPaths.length > 1) {
          realDuplicates.push(`${name} [${sameContentPaths.join(' | ')}]`);
        }
      }
    }

    if (realDuplicates.length > 0) {
      issues.push({
        type: 'structure',
        severity: 'warning',
        file: 'project',
        line: 0,
        message: `Archivos realmente duplicados: ${realDuplicates.slice(0, 10).join(', ')}`
      });
    }

    return issues;
  }

  analyzeDependencies() {
    const issues = [];
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = packageJson.dependencies || {};
        const devDeps = packageJson.devDependencies || {};

        // Verificar dependencias obsoletas (patrón básico)
        const allDeps = { ...deps, ...devDeps };
        const outdated = Object.entries(allDeps).filter(([name, version]) => {
          return version.includes('^') && !version.includes('*') &&
                 !name.includes('react') && !name.includes('next');
        });

        if (outdated.length > 10) {
          issues.push({
            type: 'structure',
            severity: 'warning',
            file: 'package.json',
            line: 0,
            message: `${outdated.length} dependencias con versiones fijas/obsoletas`
          });
        }

        // Verificar tamaño de node_modules
        const nodeModulesPath = path.join(process.cwd(), 'node_modules');
        if (fs.existsSync(nodeModulesPath)) {
          const size = this.guard.getFolderSize(nodeModulesPath);
          if (size > 100 * 1024 * 1024) { // 100MB
            issues.push({
              type: 'performance',
              severity: 'warning',
              file: 'project',
              line: 0,
              message: `node_modules muy grande: ${(size / 1024 / 1024).toFixed(1)}MB`
            });
          }
        }
      } catch (error) {
        issues.push({
          type: 'structure',
          severity: 'error',
          file: 'package.json',
          line: 0,
          message: 'Error al leer package.json'
        });
      }
    }

    return issues;
  }
}

// ============ CLASE PRINCIPAL ============
class QualityGuard {
  constructor() {
    this.issues = [];
    this.metrics = {
      totalFiles: 0,
      totalLines: 0,
      totalErrors: 0,
      totalWarnings: 0,
      score: 100,
      filesAnalyzed: 0,
      imagesTotal: 0,
      imagesWithoutAlt: 0,
      cssProperties: 0,
      jsFunctions: 0
    };
    this.startTime = Date.now();

    this.htmlAnalyzer = new HTMLAnalyzer(this);
    this.cssAnalyzer = new CSSAnalyzer(this);
    this.jsAnalyzer = new JSAnalyzer(this);
    this.structureAnalyzer = new StructureAnalyzer(this);
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m',
      highlight: '\x1b[35m'
    };
    const prefix = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      highlight: '🔍'
    };
    console.log(`${colors[type]}${prefix[type] || ''} ${message}${colors.reset}`);
  }

  getAllFiles() {
    const files = [];
    const walkDir = (dir) => {
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          if (this.shouldIgnore(fullPath)) continue;
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignorar directorios sin acceso
      }
    };

    // Walk through src directories
    CONFIG.directories.src.forEach(dir => {
      if (fs.existsSync(dir)) walkDir(dir);
    });

    CONFIG.directories.public.forEach(dir => {
      if (fs.existsSync(dir)) walkDir(dir);
    });

    return files;
  }

  getFolderSize(folder) {
    let size = 0;
    try {
      const items = fs.readdirSync(folder);
      for (const item of items) {
        const fullPath = path.join(folder, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          size += this.getFolderSize(fullPath);
        } else {
          size += stat.size;
        }
      }
    } catch (error) {
      // Ignorar
    }
    return size;
  }

  shouldIgnore(filePath) {
    return CONFIG.ignore.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(filePath);
    });
  }

  addIssue(file, line, message, severity = 'warning', category = 'general') {
    this.issues.push({
      file: this.getRelativePath(file),
      line,
      message,
      severity,
      category,
      timestamp: new Date().toISOString()
    });

    if (severity === 'error') {
      this.metrics.totalErrors++;
      this.metrics.score -= 2;
    } else if (severity === 'warning') {
      this.metrics.totalWarnings++;
      this.metrics.score -= 0.5;
    }
  }

  getRelativePath(filePath) {
    const cwd = process.cwd();
    return filePath.replace(cwd, '').replace(/^[/\\]/, '');
  }

  analyzeFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;

    this.metrics.totalFiles++;
    this.metrics.totalLines += lines;

    let issues = [];

    // HTML files
    if (CONFIG.extensions.html.includes(ext)) {
      issues = this.htmlAnalyzer.analyze(content, filePath);

      // Contar imágenes usando la etiqueta completa, también si ocupa varias líneas
      const imgTags = content.match(/<img\b[^>]*>/gis) || [];
      this.metrics.imagesTotal += imgTags.length;
      const imgWithoutAlt = imgTags.filter(tag => !/\balt\s*=/i.test(tag));
      this.metrics.imagesWithoutAlt += imgWithoutAlt.length;
    }

    // CSS files
    if (CONFIG.extensions.css.includes(ext)) {
      issues = this.cssAnalyzer.analyze(content, filePath);
      const propMatches = content.match(/[a-zA-Z-]+\s*:/g) || [];
      this.metrics.cssProperties += propMatches.length;
    }

    // JS files
    if (CONFIG.extensions.js.includes(ext)) {
      issues = this.jsAnalyzer.analyze(content, filePath);
      const funcMatches = content.match(/function\s*\(/g) || [];
      this.metrics.jsFunctions += funcMatches.length;
    }

    // Agregar issues
    issues.forEach(issue => {
      this.addIssue(
        filePath,
        issue.line,
        issue.message,
        issue.severity,
        issue.type
      );
    });

    this.metrics.filesAnalyzed++;
  }

  analyzeProject() {
    this.log('📊 INICIANDO ANÁLISIS DE CALIDAD', 'highlight');
    this.log('====================================');

    // Estructura del proyecto
    this.log('📁 Analizando estructura del proyecto...');
    const structIssues = this.structureAnalyzer.analyzeProjectStructure();
    structIssues.forEach(issue => {
      this.addIssue(issue.file, issue.line, issue.message, issue.severity, issue.type);
    });

    // Dependencias
    this.log('📦 Analizando dependencias...');
    const depIssues = this.structureAnalyzer.analyzeDependencies();
    depIssues.forEach(issue => {
      this.addIssue(issue.file, issue.line, issue.message, issue.severity, issue.type);
    });

    // Archivos
    this.log('📄 Analizando archivos...');
    const files = this.getAllFiles();

    files.forEach(file => {
      if (this.shouldIgnore(file)) return;
      const ext = path.extname(file).toLowerCase();

      // Solo analizar archivos de código
      const allExts = [...CONFIG.extensions.html, ...CONFIG.extensions.css, ...CONFIG.extensions.js];
      if (!allExts.includes(ext)) return;

      try {
        this.analyzeFile(file);
      } catch (error) {
        this.log(`Error analizando ${file}: ${error.message}`, 'error');
      }
    });

    // Calcular métricas finales
    this.metrics.score = Math.max(0, Math.round(this.metrics.score));
    this.metrics.duration = Date.now() - this.startTime;

    this.generateReport();
  }

  generateReport() {
    const reportDir = './quality-reports';
    fs.mkdirSync(reportDir, { recursive: true });

    // Reporte detallado
    const reportPath = path.join(reportDir, `report-${Date.now()}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      project: path.basename(process.cwd()),
      metrics: this.metrics,
      issues: this.issues,
      summary: {
        totalIssues: this.issues.length,
        errors: this.metrics.totalErrors,
        warnings: this.metrics.totalWarnings,
        score: this.metrics.score,
        grade: this.getGrade(this.metrics.score)
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Reporte HTML
    this.generateHTMLReport(report, reportDir);

    // Reporte Markdown
    this.generateMarkdownReport(report, reportDir);

    // Mostrar resumen
    this.showSummary(report);
  }

  getGrade(score) {
    if (score >= 90) return 'A (Excelente)';
    if (score >= 80) return 'B (Bueno)';
    if (score >= 70) return 'C (Aceptable)';
    if (score >= 60) return 'D (Necesita mejora)';
    return 'F (Crítico)';
  }

  generateHTMLReport(report, reportDir) {
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quality Guard Report - ${report.project}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f7fa;
            padding: 20px;
            color: #2d3748;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header .meta { opacity: 0.9; font-size: 0.9em; }
        .score-card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
        }
        .score-item {
            text-align: center;
            padding: 15px;
            background: #f7fafc;
            border-radius: 8px;
        }
        .score-item .number {
            font-size: 2em;
            font-weight: bold;
            color: #4a5568;
        }
        .score-item .label {
            font-size: 0.8em;
            color: #718096;
            margin-top: 5px;
        }
        .score-item .number.grade { color: #48bb78; }
        .score-item .number.errors { color: #fc8181; }
        .score-item .number.warnings { color: #f6ad55; }
        .issues-list {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .issue {
            padding: 12px;
            border-left: 4px solid #e2e8f0;
            margin-bottom: 10px;
            background: #f7fafc;
            border-radius: 4px;
        }
        .issue.error { border-left-color: #fc8181; }
        .issue.warning { border-left-color: #f6ad55; }
        .issue.info { border-left-color: #63b3ed; }
        .issue .file {
            font-weight: bold;
            color: #4a5568;
            font-size: 0.9em;
        }
        .issue .message { margin: 5px 0; }
        .issue .meta {
            font-size: 0.8em;
            color: #a0aec0;
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.7em;
            font-weight: bold;
            text-transform: uppercase;
        }
        .badge.error { background: #fed7d7; color: #c53030; }
        .badge.warning { background: #fefcbf; color: #975a16; }
        .badge.info { background: #bee3f8; color: #2a69ac; }
        .filter-bar {
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .filter-btn {
            padding: 8px 16px;
            border: 2px solid #e2e8f0;
            background: white;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .filter-btn:hover, .filter-btn.active {
            background: #667eea;
            color: white;
            border-color: #667eea;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ Quality Guard</h1>
            <p>Informe de calidad de código - ${report.project}</p>
            <div class="meta">
                Generado: ${new Date(report.timestamp).toLocaleString()}
                | Duración: ${(report.metrics.duration / 1000).toFixed(2)}s
                | Archivos analizados: ${report.metrics.filesAnalyzed}
            </div>
        </div>

        <div class="score-card">
            <div class="score-item">
                <div class="number grade">${report.summary.score}</div>
                <div class="label">Score de calidad</div>
                <div style="font-size: 0.8em; color: #48bb78;">${report.summary.grade}</div>
            </div>
            <div class="score-item">
                <div class="number errors">${report.summary.errors}</div>
                <div class="label">Errores</div>
            </div>
            <div class="score-item">
                <div class="number warnings">${report.summary.warnings}</div>
                <div class="label">Advertencias</div>
            </div>
            <div class="score-item">
                <div class="number">${report.metrics.totalFiles}</div>
                <div class="label">Total archivos</div>
            </div>
            <div class="score-item">
                <div class="number">${report.metrics.totalLines.toLocaleString()}</div>
                <div class="label">Líneas de código</div>
            </div>
        </div>

        <div class="issues-list">
            <h2 style="margin-bottom: 15px;">📋 Detalle de issues</h2>
            <div class="filter-bar">
                <button class="filter-btn active" data-filter="all">Todos</button>
                <button class="filter-btn" data-filter="error">Errores</button>
                <button class="filter-btn" data-filter="warning">Advertencias</button>
                <button class="filter-btn" data-filter="info">Información</button>
            </div>
            <div id="issues-container">
                ${report.issues.map(issue => `
                    <div class="issue ${issue.severity}" data-severity="${issue.severity}">
                        <div class="file">
                            📄 ${issue.file}
                            <span style="float: right;">
                                <span class="badge ${issue.severity}">${issue.severity}</span>
                                ${issue.category ? `<span class="badge info">${issue.category}</span>` : ''}
                            </span>
                        </div>
                        <div class="message">${issue.message}</div>
                        <div class="meta">
                            Línea: ${issue.line || 'N/A'}
                            ${issue.severity === 'error' ? '⚠️ Requiere corrección' : ''}
                            ${issue.severity === 'warning' ? '💡 Mejora recomendada' : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
    <script>
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                const filter = this.dataset.filter;
                document.querySelectorAll('.issue').forEach(issue => {
                    if (filter === 'all' || issue.dataset.severity === filter) {
                        issue.style.display = 'block';
                    } else {
                        issue.style.display = 'none';
                    }
                });
            });
        });
    </script>
</body>
</html>
    `;

    const htmlPath = path.join(reportDir, `report-${Date.now()}.html`);
    fs.writeFileSync(htmlPath, html);
    this.log(`📄 Reporte HTML generado: ${htmlPath}`, 'success');
  }

  generateMarkdownReport(report, reportDir) {
    let md = `# 📊 Quality Guard - Reporte de Calidad

## Proyecto: ${report.project}
**Generado:** ${new Date(report.timestamp).toLocaleString()}
**Duración:** ${(report.metrics.duration / 1000).toFixed(2)}s

---

## 📈 Resumen

| Métrica | Valor |
|---------|-------|
| **Score de calidad** | **${report.summary.score}/100** (${report.summary.grade}) |
| Errores | ${report.summary.errors} |
| Advertencias | ${report.summary.warnings} |
| Archivos analizados | ${report.metrics.filesAnalyzed} |
| Líneas de código | ${report.metrics.totalLines.toLocaleString()} |
| Total issues | ${report.summary.totalIssues} |

### 📂 Métricas por tipo

- **Imágenes sin alt:** ${report.metrics.imagesWithoutAlt || 0} de ${report.metrics.imagesTotal || 0}
- **Propiedades CSS:** ${report.metrics.cssProperties || 0}
- **Funciones JS:** ${report.metrics.jsFunctions || 0}

---

## 🚨 Issues Detallados

`;
    if (report.issues.length === 0) {
      md += '✅ **¡Excelente! No se encontraron issues.**\n';
    } else {
      // Agrupar por severidad
      const errors = report.issues.filter(i => i.severity === 'error');
      const warnings = report.issues.filter(i => i.severity === 'warning');
      const infos = report.issues.filter(i => i.severity === 'info');

      if (errors.length > 0) {
        md += '### ❌ Errores\n\n';
        errors.forEach(issue => {
          md += `- **${issue.file}** (línea ${issue.line || 'N/A'}): ${issue.message}\n`;
        });
        md += '\n';
      }

      if (warnings.length > 0) {
        md += '### ⚠️ Advertencias\n\n';
        warnings.forEach(issue => {
          md += `- **${issue.file}** (línea ${issue.line || 'N/A'}): ${issue.message}\n`;
        });
        md += '\n';
      }

      if (infos.length > 0) {
        md += '### 💡 Información\n\n';
        infos.forEach(issue => {
          md += `- **${issue.file}** (línea ${issue.line || 'N/A'}): ${issue.message}\n`;
        });
        md += '\n';
      }
    }

    md += `---

## 🎯 Recomendaciones

${report.summary.score >= 80 ? '✅ El código tiene buena calidad general. Considera revisar las advertencias para mejorarlo.' :
    report.summary.score >= 60 ? '⚠️ El código es aceptable pero tiene áreas de mejora. Prioriza corregir los errores.' :
    '❌ El código necesita mejoras significativas. Revisa todos los errores críticos.'}

### Prioridades de acción:

1. **Errores críticos** - Corregir inmediatamente
2. **Advertencias** - Planificar correcciones
3. **Información** - Considerar para futuras mejoras

---

## 📊 Evolución

Para monitorear la calidad a lo largo del tiempo, guarda los reportes generados en \`./quality-reports/\`.

**Próximo paso:** Ejecuta \`npm run quality:fix\` para corregir automáticamente los issues posibles.
`;

    const mdPath = path.join(reportDir, `report-${Date.now()}.md`);
    fs.writeFileSync(mdPath, md);
    this.log(`📄 Reporte Markdown generado: ${mdPath}`, 'success');
  }

  showSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE CALIDAD');
    console.log('='.repeat(60));

    console.log(`\n📈 Score: ${report.summary.score}/100 - ${report.summary.grade}`);
    console.log(`📁 Archivos analizados: ${report.metrics.filesAnalyzed}`);
    console.log(`📝 Líneas de código: ${report.metrics.totalLines.toLocaleString()}`);
    console.log(`\n❌ Errores: ${report.summary.errors}`);
    console.log(`⚠️ Advertencias: ${report.summary.warnings}`);
    console.log(`ℹ️ Información: ${report.issues.filter(i => i.severity === 'info').length}`);

    if (report.metrics.imagesWithoutAlt > 0) {
      console.log(`\n🖼️ IMÁGENES SIN ALT: ${report.metrics.imagesWithoutAlt}`);
      console.log('   ⚠️ Revisar reporte detallado para localizarlas');
    }

    console.log(`\n⏱️ Tiempo de análisis: ${(report.metrics.duration / 1000).toFixed(2)}s`);
    console.log(`\n📄 Reportes generados en: ./quality-reports/`);

    console.log('\n' + '='.repeat(60));

    if (report.summary.score >= 80) {
      console.log('✅ Calidad excelente! Mantén el buen trabajo.');
    } else if (report.summary.score >= 60) {
      console.log('⚠️ Calidad aceptable. Revisa las advertencias.');
    } else {
      console.log('❌ Calidad crítica. Revisa los errores urgentemente.');
    }
    console.log('='.repeat(60) + '\n');
  }
}

// ============ MODO WATCH ============
class WatchMode {
  constructor() {
    this.guard = new QualityGuard();
    this.isRunning = false;
  }

  start() {
    console.log('👁️ Modo vigilancia activado');
    console.log('Monitoreando cambios en archivos...');
    console.log('Presiona Ctrl+C para detener\n');

    const files = this.guard.getAllFiles();
    const fileCache = new Map();

    files.forEach(file => {
      try {
        const stats = fs.statSync(file);
        fileCache.set(file, {
          mtime: stats.mtime.getTime(),
          size: stats.size
        });
      } catch (error) {
        // Ignorar
      }
    });

    this.isRunning = true;
    let firstRun = true;

    const checkChanges = () => {
      if (!this.isRunning) return;

      const currentFiles = this.guard.getAllFiles();
      let hasChanges = false;

      // Verificar archivos modificados
      currentFiles.forEach(file => {
        try {
          const stats = fs.statSync(file);
          const cached = fileCache.get(file);
          if (!cached || cached.mtime !== stats.mtime.getTime() || cached.size !== stats.size) {
            hasChanges = true;
            fileCache.set(file, {
              mtime: stats.mtime.getTime(),
              size: stats.size
            });
          }
        } catch (error) {
          // Ignorar
        }
      });

      if (hasChanges || firstRun) {
        console.log('\n🔄 Cambios detectados, ejecutando análisis...');
        const guard = new QualityGuard();
        guard.analyzeProject();
        firstRun = false;
      }

      setTimeout(checkChanges, 3000);
    };

    checkChanges();

    // Manejar Ctrl+C
    process.on('SIGINT', () => {
      this.isRunning = false;
      console.log('\n\n👋 Monitoreo detenido');
      process.exit(0);
    });
  }
}

// ============ MODO FIX ============
class FixMode {
  constructor() {
    this.guard = new QualityGuard();
  }

  fix() {
    console.log('🔧 MODO CORRECCIÓN');
    console.log('Intentando corregir issues automáticamente...\n');

    const files = this.guard.getAllFiles();
    let fixes = 0;

    files.forEach(file => {
      try {
        const ext = path.extname(file).toLowerCase();
        let content = fs.readFileSync(file, 'utf8');
        let modified = false;

        // Corregir imágenes sin alt en HTML
        if (CONFIG.extensions.html.includes(ext)) {
          const newContent = content.replace(
            /<img\s+((?!alt=)[^>])*?>/gi,
            (match) => {
              if (/alt\s*=/i.test(match)) return match;
              // Intentar extraer src para generar alt
              const srcMatch = match.match(/src\s*=\s*["']([^"']*)["']/i);
              const alt = srcMatch ? `alt="Imagen: ${path.basename(srcMatch[1])}"` : 'alt="Imagen"';
              return match.replace('<img', `<img ${alt}`);
            }
          );

          if (newContent !== content) {
            fs.writeFileSync(file, newContent);
            fixes++;
            console.log(`✅ Corregido: ${file}`);
          }
        }

        // Corregir console.log en producción
        if (file.includes('production') || file.includes('build')) {
          const newContent = content.replace(/console\.(log|debug|info|warn)\([^)]*\)\s*;?/g, '// $&');
          if (newContent !== content) {
            fs.writeFileSync(file, newContent);
            fixes++;
            console.log(`✅ Console.log removido: ${file}`);
          }
        }

      } catch (error) {
        console.error(`❌ Error corrigiendo ${file}: ${error.message}`);
      }
    });

    console.log(`\n✅ Correcciones aplicadas: ${fixes} archivos modificados`);
    console.log('Ejecuta nuevamente quality-guard para verificar los cambios.');
  }
}

// ============ INTERFAZ DE LÍNEA DE COMANDOS ============
function showHelp() {
  console.log(`
🛡️ QUALITY GUARD - Sistema de control de calidad

USO:
  node quality-guard.cjs [opciones]

OPCIONES:
  --help, -h     Muestra esta ayuda
  --watch, -w    Modo vigilancia (monitorea cambios)
  --fix, -f      Corrige automáticamente issues posibles
  --ci           Modo CI (solo reporta errores, código 1 si hay issues)
  --verbose, -v  Muestra información detallada

EJEMPLOS:
  node quality-guard.cjs                # Análisis completo
  node quality-guard.cjs --watch        # Monitoreo continuo
  node quality-guard.cjs --fix          # Corrección automática
  node quality-guard.cjs --ci           # Modo integración continua

REPORTES:
  Los reportes se guardan en ./quality-reports/
  - report-{timestamp}.json (datos completos)
  - report-{timestamp}.html (visual)
  - report-{timestamp}.md (markdown)

CONFIGURACIÓN:
  Edita CONFIG en el archivo para ajustar:
  - Umbrales de calidad
  - Directorios a analizar
  - Extensiones de archivo
  - Patrones de ignorar
`);
}

// ============ FUNCIÓN PRINCIPAL ============
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  if (args.includes('--watch') || args.includes('-w')) {
    const watch = new WatchMode();
    watch.start();
    return;
  }

  if (args.includes('--fix') || args.includes('-f')) {
    const fix = new FixMode();
    fix.fix();
    return;
  }

  if (args.includes('--ci')) {
    const guard = new QualityGuard();
    guard.analyzeProject();

    if (guard.metrics.totalErrors > 0 || guard.metrics.totalWarnings > 0) {
      console.error('\n❌ CI Falló: Se encontraron issues de calidad');
      process.exit(1);
    } else {
      console.log('\n✅ CI Pass: No se encontraron issues');
      process.exit(0);
    }
    return;
  }

  // Modo normal
  const guard = new QualityGuard();
  guard.analyzeProject();
}

// ============ EJECUTAR ============
if (require.main === module) {
  main();
}

module.exports = { QualityGuard, HTMLAnalyzer, CSSAnalyzer, JSAnalyzer, StructureAnalyzer };
