import fs from 'node:fs';

const html = fs.readFileSync(new URL('../pages/admin-editor-v4.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../js/admin-editor-v4.js', import.meta.url), 'utf8');
const hours = fs.readFileSync(new URL('../js/admin-editor-v4-horarios.js', import.meta.url), 'utf8');
const login = fs.readFileSync(new URL('../js/admin-login.js', import.meta.url), 'utf8');
const sql = fs.readFileSync(new URL('../supabase/2026-08-11_admin_editor_v4.sql', import.meta.url), 'utf8');

const checks = [
  ['HTML admin noindex', html.includes('name="robots" content="noindex,nofollow"')],
  ['HTML responsive CSS', html.includes('admin-editor-v4.css')],
  ['HTML export CSV', html.includes('v4-exportar-csv')],
  ['HTML export Excel', html.includes('v4-exportar-xlsx')],
  ['HTML ficha pública', html.includes('v4-ver-publica')],
  ['HTML editor visual de horarios', html.includes('v4-horarios-editor') && html.includes('admin-editor-v4-horarios.js')],
  ['HTML oculta contenido durante autenticación', html.includes('data-auth-state="checking"') && html.includes('v4-auth-check')],
  ['JS autentica administrador', js.includes("sb.rpc('es_administrador')")],
  ['JS redirige al login protegido', js.includes("admin-login.html?next=admin-editor-v4.html")],
  ['Login conserva destino administrativo seguro', login.includes('destinoAdmin') && login.includes('siguienteSolicitado')],
  ['JS pagina talleres de 100 en 100', js.includes('p_limite:100') && js.includes('all.length<total')],
  ['JS usa RPC admin de lectura', js.includes("admin_obtener_taller_editor_v4")],
  ['JS usa RPC admin de guardado', js.includes("admin_actualizar_taller_editor_v4")],
  ['JS usa slug canónico', js.includes('state.actual?.slug')],
  ['JS exporta XLSX', js.includes('XLSX.writeFile')],
  ['JS valida horario visual', js.includes('TallerMapHorariosV4') && hours.includes('Horario semanal válido.')],
  ['Horario usa selectores estables', hours.includes('OPCIONES_HORA') && hours.includes('<select') && !hours.includes('type="time"')],
  ['Horario cubre siete días y dos turnos', hours.includes("['domingo','Domingo']") && hours.includes("data-hours-kind=\"t2\"")],
  ['JS no usa URL legacy', !js.includes('/pages/taller.html?id=')],
  ['SQL valida administrador', sql.includes('public.es_administrador()')],
  ['SQL soporta 52 provincias', sql.includes("when n='melilla' then '52'")],
  ['SQL valida municipio y CP', sql.includes('municipio_codigo_postal_no_coinciden')],
  ['SQL crea lectura admin', sql.includes('admin_obtener_taller_editor_v4')],
  ['SQL crea guardado admin', sql.includes('admin_actualizar_taller_editor_v4')],
  ['SQL revoca acceso anónimo', sql.match(/from public, anon, authenticated/g)?.length === 2]
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${name}`);
if (failed.length) {
  console.error(`Editor V4: ${failed.length} validaciones fallidas.`);
  process.exit(1);
}
console.log('Editor V4: validación estructural correcta.');
