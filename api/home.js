import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
const INITIAL_WORKSHOPS = 24;

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function safeSlug(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function titleFromSlug(slug) {
    return String(slug || "")
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

async function fetchInitialWorkshops() {
    const endpoint = `${SUPABASE_URL}/rest/v1/rpc/listar_talleres_sitemap`;
    const result = await fetch(endpoint, {
        method: "POST",
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            p_limite: INITIAL_WORKSHOPS,
            p_desde: 0
        })
    });

    if (!result.ok) {
        const message = await result.text().catch(() => "");
        throw new Error(`Supabase respondió ${result.status}: ${message.slice(0, 300)}`);
    }

    const rows = await result.json();
    return Array.isArray(rows) ? rows : [];
}

function renderInitialWorkshopLinks(workshops) {
    const unique = Array.from(
        new Map(
            workshops
                .map((workshop) => {
                    const slug = safeSlug(workshop?.slug);
                    return [slug, workshop];
                })
                .filter(([slug]) => Boolean(slug))
        ).values()
    );

    if (!unique.length) {
        return '<p class="mensaje-talleres">Consulta talleres publicados por población, código postal o servicio.</p>';
    }

    return unique.map((workshop) => {
        const slug = safeSlug(workshop.slug);
        const name = workshop.nombre || workshop.name || titleFromSlug(slug);
        const city = workshop.ciudad || workshop.poblacion || workshop.municipio || "";
        const province = workshop.provincia || "";
        const location = [city, province].filter(Boolean).join(", ");

        return `
            <article class="taller-card taller-card-inicial" data-taller-slug="${escapeHTML(slug)}">
                <div class="taller-informacion">
                    <h3><a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">${escapeHTML(name)}</a></h3>
                    ${location ? `<p class="ubicacion">⌖ ${escapeHTML(location)}</p>` : ""}
                    <p class="taller-descripcion">Consulta la ficha del taller, sus servicios y datos de contacto.</p>
                    <div class="taller-pie">
                        <span class="taller-contactos"><a class="enlace-ficha-taller" href="/talleres/${encodeURIComponent(slug)}">Ver ficha</a></span>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

function injectWorkshopLinks(html, workshopHTML) {
    const pattern = /(<div\s+class="talleres-grid"\s+id="lista-talleres"[^>]*>)([\s\S]*?)(<\/div>\s*<div\s+id="contenedor-cargar-mas")/i;

    if (!pattern.test(html)) {
        throw new Error("No se encontró el contenedor #lista-talleres en index.html");
    }

    return html.replace(pattern, `$1${workshopHTML}$3`);
}

function injectMobileMenu(html) {
    const styles = `
<style id="tallermap-menu-movil-estilos">
.menu-movil-boton,.menu-movil-panel{display:none}
@media(max-width:1050px){
.cabecera-contenido{position:relative}
.menu-movil-boton{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;flex:0 0 auto;width:46px;height:46px;margin-left:auto;padding:0;color:#071a33;background:#fff;border:1px solid #dfe6ef;border-radius:12px;box-shadow:0 8px 20px rgba(20,36,64,.08);cursor:pointer}
.menu-movil-boton span,.menu-movil-boton:before,.menu-movil-boton:after{display:block;width:22px;height:2px;content:"";background:currentColor;border-radius:4px;transition:transform .2s ease,opacity .2s ease}
.menu-movil-boton[aria-expanded="true"] span{opacity:0}
.menu-movil-boton[aria-expanded="true"]:before{transform:translateY(7px) rotate(45deg)}
.menu-movil-boton[aria-expanded="true"]:after{transform:translateY(-7px) rotate(-45deg)}
.menu-movil-panel{position:absolute;top:100%;right:0;left:0;z-index:120;padding:10px 20px 18px;background:rgba(255,255,255,.99);border-bottom:1px solid #dfe6ef;box-shadow:0 18px 30px rgba(20,36,64,.12)}
.menu-movil-panel.abierto{display:grid;gap:4px}
.menu-movil-panel a{display:block;padding:13px 14px;color:#071a33;font-weight:800;border-radius:10px}
.menu-movil-panel a:hover,.menu-movil-panel a:focus-visible{background:#eaf2ff;outline:none}
.menu-movil-panel .menu-movil-registro{margin-top:5px;color:#fff;text-align:center;background:linear-gradient(135deg,#1457d9,#0b43ad)}
}
@media(max-width:750px){.cabecera-contenido{min-height:68px;gap:12px}.acciones-cabecera{display:none}.marca-texto strong{font-size:20px}}
</style>`;

    const script = `
<script id="tallermap-menu-movil-script">
(function(){
'use strict';
var header=document.querySelector('.cabecera-contenido');
var desktopMenu=document.querySelector('.menu');
if(!header||!desktopMenu||document.querySelector('.menu-movil-boton'))return;
var button=document.createElement('button');
button.type='button';
button.className='menu-movil-boton';
button.setAttribute('aria-label','Abrir menú de navegación');
button.setAttribute('aria-expanded','false');
button.setAttribute('aria-controls','menu-movil-panel');
button.innerHTML='<span aria-hidden="true"></span>';
var panel=document.createElement('nav');
panel.id='menu-movil-panel';
panel.className='menu-movil-panel';
panel.setAttribute('aria-label','Navegación móvil');
Array.from(desktopMenu.querySelectorAll('a')).forEach(function(link){panel.appendChild(link.cloneNode(true));});
var register=document.createElement('a');
register.href='/pages/registro.html';
register.className='menu-movil-registro';
register.textContent='Registrar taller';
panel.appendChild(register);
var actions=header.querySelector('.acciones-cabecera');
header.insertBefore(button,actions||null);
header.appendChild(panel);
function closeMenu(){button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Abrir menú de navegación');panel.classList.remove('abierto');}
button.addEventListener('click',function(){var open=button.getAttribute('aria-expanded')==='true';if(open){closeMenu();}else{button.setAttribute('aria-expanded','true');button.setAttribute('aria-label','Cerrar menú de navegación');panel.classList.add('abierto');}});
panel.addEventListener('click',function(event){if(event.target.closest('a'))closeMenu();});
document.addEventListener('click',function(event){if(!panel.classList.contains('abierto'))return;if(!panel.contains(event.target)&&!button.contains(event.target))closeMenu();});
document.addEventListener('keydown',function(event){if(event.key==='Escape')closeMenu();});
window.addEventListener('resize',function(){if(window.innerWidth>1050)closeMenu();});
}());
</script>`;

    return html.replace("</head>", `${styles}\n</head>`).replace("</body>", `${script}\n</body>`);
}

export default async function handler(_request, response) {
    let html;

    try {
        html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
    } catch (error) {
        console.error("No se pudo leer index.html:", error);
        response.status(500).send("No se pudo renderizar la portada.");
        return;
    }

    try {
        const workshops = await fetchInitialWorkshops();
        html = injectWorkshopLinks(html, renderInitialWorkshopLinks(workshops));
        response.setHeader("X-TallerMap-Initial-Workshop-Links", String(Math.min(workshops.length, INITIAL_WORKSHOPS)));
    } catch (error) {
        console.error("No se pudieron renderizar talleres iniciales:", error);
        response.setHeader("X-TallerMap-Initial-Workshop-Links", "0");
    }

    html = injectMobileMenu(html);

    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    response.status(200).send(html);
}
