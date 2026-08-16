import fs from 'node:fs';
const html=fs.readFileSync(new URL('../pages/admin-editor-v4-desguaces.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../js/admin-editor-v4-desguaces.js',import.meta.url),'utf8');
const checks=[
 ['noindex,nofollow',html.includes('noindex,nofollow')],
 ['botón comprobar CSV',html.includes('v4d-comprobar-csv')],
 ['botón importar separado',html.includes('v4d-importar-csv')],
 ['importar deshabilitado inicialmente',html.includes('id="v4d-importar-csv"')&&html.includes('disabled>Importar válidos en Supabase')],
 ['plantilla CSV',html.includes('v4d-plantilla-csv')],
 ['RPC importar',js.includes("admin_importar_desguaces")],
 ['comprobación no escribe',js.includes('No se ha guardado nada.')],
 ['importados pendientes',js.includes('activo=false')||js.includes('o.activo=false')],
 ['importados no verificados',js.includes('verificado=false')||js.includes('o.verificado=false')],
 ['límite 10 MB',js.includes('10*1024*1024')],
 ['duplicados CSV',js.includes('Duplicado dentro del CSV')],
 ['duplicados Supabase',js.includes('Posible duplicado existente')]
];
let bad=0;for(const [name,ok] of checks){console.log(`${ok?'OK':'ERROR'} ${name}`);if(!ok)bad++;}
if(bad)process.exit(1);console.log(`Validación correcta: ${checks.length} comprobaciones.`);
