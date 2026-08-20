import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
import { SUPABASE_URL } from '../lib/server-utils.js';

const BUCKET = 'solicitudes-piezas';

function clean(value, max = 1500) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function validCode(value) {
  const codigo = clean(value, 80).toUpperCase();
  return /^TM-[A-Z0-9-]{6,70}$/.test(codigo) ? codigo : '';
}

function serviceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en Vercel');
  return key;
}

async function serviceFetch(path, options = {}) {
  const key = serviceKey();
  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });
}

async function getSolicitud(codigo) {
  const select = [
    'codigo','estado','nombre_cliente','marca','modelo','anio','matricula','motor_version','vin',
    'pieza','lado','preferencia_pieza','referencia_pieza','observaciones',
    'resultado','entrega','precio','gastos_envio','created_at',
    'imagen_1_path','imagen_2_path','imagen_3_path','desguaces(nombre,slug)'
  ].join(',');
  const r = await serviceFetch(`/rest/v1/solicitudes_piezas?codigo=eq.${encodeURIComponent(codigo)}&select=${encodeURIComponent(select)}&limit=1`);
  if (!r.ok) throw new Error(`No se pudo cargar la solicitud (${r.status})`);
  const rows = await r.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

function estadoLabel(value) {
  const labels = {
    recibida: 'Solicitud recibida',
    en_revision: 'En revision',
    'en-revision': 'En revision',
    disponible: 'Pieza disponible',
    no_disponible: 'Pieza no disponible',
    'no-disponible': 'Pieza no disponible',
    cerrada: 'Solicitud cerrada'
  };
  return labels[value] || clean(value, 60) || 'Solicitud recibida';
}

function formatMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2).replace('.', ',')} EUR` : '';
}

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(d);
}

function wrapText(text, font, size, maxWidth) {
  const words = clean(text, 5000).split(' ').filter(Boolean);
  if (!words.length) return ['-'];
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      line = word;
      continue;
    }
    let chunk = '';
    for (const ch of word) {
      const next = chunk + ch;
      if (font.widthOfTextAtSize(next, size) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = next;
      }
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines;
}

async function fetchImage(path) {
  if (!path) return null;
  const safe = clean(path, 500);
  if (!/^solicitudes\/TM-[A-Z0-9-]{6,70}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(safe)) return null;
  const encoded = safe.split('/').map(encodeURIComponent).join('/');
  const r = await serviceFetch(`/storage/v1/object/authenticated/${BUCKET}/${encoded}`);
  if (!r.ok) return null;
  const bytes = Buffer.from(await r.arrayBuffer());
  const ext = safe.split('.').pop().toLowerCase();
  if (ext === 'webp') {
    return { bytes: await sharp(bytes).png().toBuffer(), type: 'png' };
  }
  return { bytes, type: ext === 'png' ? 'png' : 'jpg' };
}

async function buildPdf(s) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize = [595.28, 841.89];
  const margin = 48;
  const contentWidth = pageSize[0] - margin * 2;
  const lineHeight = 15;
  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - 52;

  function newPage() {
    page = pdf.addPage(pageSize);
    y = pageSize[1] - 52;
  }

  function ensure(height) {
    if (y - height < 48) newPage();
  }

  function drawText(text, x, yy, size = 10, font = regular, color = rgb(0.12, 0.16, 0.23)) {
    page.drawText(clean(text, 5000), { x, y: yy, size, font, color });
  }

  function heading(text) {
    ensure(34);
    y -= 8;
    drawText(text, margin, y, 14, bold, rgb(0.07, 0.18, 0.38));
    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: pageSize[0] - margin, y }, thickness: 0.7, color: rgb(0.86, 0.89, 0.93) });
    y -= 18;
  }

  function field(label, value) {
    const val = clean(value, 5000) || '-';
    const labelWidth = 118;
    const maxWidth = contentWidth - labelWidth;
    const lines = wrapText(val, regular, 10, maxWidth);
    const height = Math.max(1, lines.length) * lineHeight + 4;
    ensure(height + 4);
    drawText(label, margin, y, 10, bold);
    lines.forEach((line, i) => drawText(line, margin + labelWidth, y - i * lineHeight, 10, regular));
    y -= height;
  }

  drawText('TallerMap', margin, y, 22, bold, rgb(0.04, 0.16, 0.34));
  drawText('Solicitud de pieza', margin, y - 28, 17, bold);
  y -= 54;
  page.drawRectangle({ x: margin, y: y - 28, width: contentWidth, height: 34, color: rgb(0.93, 0.98, 0.95), borderColor: rgb(0.72, 0.91, 0.79), borderWidth: 0.7 });
  drawText(estadoLabel(s.estado), margin + 12, y - 16, 11, bold, rgb(0.02, 0.48, 0.27));
  y -= 48;

  field('Codigo', s.codigo);
  field('Fecha', formatDate(s.created_at));
  field('Desguace', s.desguaces?.nombre);

  heading('Vehiculo');
  field('Marca', s.marca);
  field('Modelo', s.modelo);
  field('Ano', s.anio ? String(s.anio) : '');
  field('Matricula', s.matricula);
  field('Motor / version', s.motor_version);
  field('VIN / bastidor', s.vin);

  heading('Pieza solicitada');
  field('Pieza', s.pieza);
  field('Lado', s.lado);
  field('Preferencia', s.preferencia_pieza);
  field('Referencia', s.referencia_pieza);
  field('Observaciones', s.observaciones);

  if (s.resultado || s.entrega || s.precio !== null || s.gastos_envio !== null) {
    heading('Respuesta del desguace');
    field('Respuesta', s.resultado);
    field('Entrega', s.entrega);
    if (s.precio !== null) field('Precio', formatMoney(s.precio));
    if (s.gastos_envio !== null) field('Gastos envio', formatMoney(s.gastos_envio));
    if (s.precio !== null) {
      const total = Number(s.precio || 0) + Number(s.gastos_envio || 0);
      field('Total', formatMoney(total));
    }
  }

  const paths = [s.imagen_1_path, s.imagen_2_path, s.imagen_3_path].filter(Boolean);
  if (paths.length) {
    heading('Fotografias adjuntas');
    for (let i = 0; i < paths.length; i++) {
      const imageData = await fetchImage(paths[i]);
      if (!imageData) continue;
      let img;
      try {
        img = imageData.type === 'png' ? await pdf.embedPng(imageData.bytes) : await pdf.embedJpg(imageData.bytes);
      } catch {
        continue;
      }
      const maxW = contentWidth;
      const maxH = 500;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      ensure(h + 38);
      drawText(`Foto ${i + 1}`, margin, y, 10, bold);
      y -= 18;
      page.drawImage(img, { x: margin, y: y - h, width: w, height: h });
      y -= h + 24;
    }
  }

  ensure(34);
  page.drawLine({ start: { x: margin, y: 38 }, end: { x: pageSize[0] - margin, y: 38 }, thickness: 0.5, color: rgb(0.82, 0.85, 0.9) });
  drawText('Documento generado por TallerMap - tallermap.es', margin, 24, 8, regular, rgb(0.42, 0.46, 0.53));

  pdf.setTitle(`Solicitud ${s.codigo}`);
  pdf.setAuthor('TallerMap');
  pdf.setSubject('Solicitud de pieza de recambio');
  return pdf.save();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).send('Metodo no permitido');
    return;
  }

  const codigo = validCode(req.query?.codigo);
  if (!codigo) {
    res.status(400).send('Codigo de solicitud no valido.');
    return;
  }

  try {
    const solicitud = await getSolicitud(codigo);
    if (!solicitud) {
      res.status(404).send('Solicitud no encontrada.');
      return;
    }
    const bytes = await buildPdf(solicitud);
    const filename = `solicitud-${codigo.toLowerCase()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(Buffer.from(bytes));
  } catch (error) {
    console.error('solicitud-pdf', error);
    res.status(500).send('No se pudo generar el PDF.');
  }
}
