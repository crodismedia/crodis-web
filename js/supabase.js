const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function escaparHTML(valor) {
    const elemento = document.createElement("div");
    elemento.textContent = valor ?? "";
    return elemento.innerHTML;
}

function crearTarjetaTaller(taller) {
    const nombre = escaparHTML(taller.nombre || "Taller sin nombre");
    const ciudad = escaparHTML(taller.ciudad || "");
    const provincia = escaparHTML(taller.provincia || "");
    const descripcion = escaparHTML(
        taller.descripcion || "Información próximamente disponible."
    );
    const ubicacion = [ciudad, provincia].filter(Boolean).join(", ");
    const telefono = (taller.telefono || "").replace(/[^\d+]/g, "");
    const distintivo = taller.verificado ? "✓ Verificado" : "Nuevo";
    const botonContacto = telefono
        ? `<a href="tel:${telefono}">Llamar</a>`
        : '<a href="#">Ver taller</a>';

    return `
        <article class="taller-card">
            <div class="taller-imagen taller-imagen-1">
                <span class="verificado">${distintivo}</span>
                <span class="favorito">♡</span>
            </div>
            <div class="taller-informacion">
                <div class="valoracion">★ Nuevo <span>Sin opiniones todavía</span></div>
                <h3>${nombre}</h3>
                <p class="ubicacion">⌖ ${ubicacion || "Ubicación no indicada"}</p>
                <p>${descripcion}</p>
                <div class="especialidades">
                    <span>Taller mecánico</span>
                    ${provincia ? `<span>${provincia}</span>` : ""}
                </div>
                <div class="taller-pie">
                    <span class="abierto">● Disponible</span>
                    ${botonContacto}
                </div>
            </div>
        </article>
    `;
}

function mostrarMensaje(contenedor, mensaje) {
    contenedor.innerHTML = `<p class="mensaje-talleres">${escaparHTML(mensaje)}</p>`;
}

async function cargarTalleres(ubicacion = "") {
    const contenedor = document.getElementById("lista-talleres");
    if (!contenedor) return;

    mostrarMensaje(contenedor, "Cargando talleres...");

    let consulta = supabaseClient
        .from("talleres")
        .select("*")
        .eq("activo", true);
    const termino = ubicacion.trim();
    if (termino) {
        const terminoEscapado = termino.replaceAll(",", "\\,");
        consulta = consulta.or(
            `ciudad.ilike.%${terminoEscapado}%,provincia.ilike.%${terminoEscapado}%`
        );
    }

    const { data: talleres, error } = await consulta;
    if (error) {
        console.error("No se pudieron cargar los talleres:", error);
        mostrarMensaje(contenedor, "No se pudieron cargar los talleres. Inténtalo de nuevo más tarde.");
        return;
    }
    if (!talleres?.length) {
        mostrarMensaje(contenedor, "No hemos encontrado talleres con esos criterios.");
        return;
    }
    contenedor.innerHTML = talleres.map(crearTarjetaTaller).join("");
}

function iniciarAplicacion() {
    cargarTalleres();

    const botonBuscar = document.getElementById("boton-buscar");
    const campoUbicacion = document.getElementById("ubicacion");

    botonBuscar?.addEventListener("click", () => {
        cargarTalleres(campoUbicacion?.value || "");
        document.getElementById("talleres")?.scrollIntoView({ behavior: "smooth" });
    });
    campoUbicacion?.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter") {
            evento.preventDefault();
            botonBuscar?.click();
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarAplicacion);
} else {
    iniciarAplicacion();
}
