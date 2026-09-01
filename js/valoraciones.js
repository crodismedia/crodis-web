(function () {
    "use strict";

    // ========== DEPENDENCIAS ==========
    if (!window.supabaseClient) {
        console.error("[Valoraciones] Dependencia faltante: cliente Supabase");
        return;
    }

    if (!window.TallerMapTallerUrls) {
        console.warn("[Valoraciones] Dependencia faltante: taller-urls-core.js");
    }

    // ========== CONFIGURACIÓN ==========
    const CONFIG = {
        DEBUG: false,
        CACHE_DURATION: 300000, // 5 minutos
        STORAGE_KEY: "tallermap_valoraciones_cache",
        MAX_VALORACIONES: 50,
        MAX_COMENTARIO: 500,
        MAX_TITULO: 100,
        ESTRELLAS_MAX: 5,
        MIN_VALORACION: 1,
        RATING_STORAGE_KEY: "tallermap_ratings",
        TIMEOUT_SUBMIT: 30000,
    };

    // ========== LOGGING ==========
    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log("[Valoraciones]", ...args);
        }
    }

    // ========== REFERENCIAS ==========
    const supabase = window.supabaseClient;
    const core = window.TallerMapTallerUrls || {};

    // ========== ESTADO ==========
    const state = {
        talleresValorados: new Map(),
        valoracionesActuales: [],
        cargando: false,
        enviando: false,
        error: null,
        usuarioActual: null,
        filtros: {
            estrellas: null,
            orden: 'recientes',
            conComentario: false,
        },
        paginacion: {
            pagina: 1,
            porPagina: 10,
            total: 0,
        },
    };

    // ========== CACHE ==========
    function guardarCache(key, data) {
        try {
            const item = {
                data: data,
                timestamp: Date.now(),
                expiry: CONFIG.CACHE_DURATION,
            };
            localStorage.setItem(`${CONFIG.STORAGE_KEY}_${key}`, JSON.stringify(item));
            log(`Cache guardado para ${key}`);
        } catch (error) {
            console.warn("[Valoraciones] Error al guardar cache:", error);
        }
    }

    function cargarCache(key) {
        try {
            const itemStr = localStorage.getItem(`${CONFIG.STORAGE_KEY}_${key}`);
            if (!itemStr) return null;

            const item = JSON.parse(itemStr);
            const ahora = Date.now();

            if (ahora - item.timestamp > item.expiry) {
                localStorage.removeItem(`${CONFIG.STORAGE_KEY}_${key}`);
                log(`Cache expirado para ${key}`);
                return null;
            }

            log(`Cache cargado para ${key}`);
            return item.data;
        } catch (error) {
            console.warn("[Valoraciones] Error al cargar cache:", error);
            return null;
        }
    }

    function limpiarCache() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(CONFIG.STORAGE_KEY)) {
                    localStorage.removeItem(key);
                }
            });
            log("Cache de valoraciones limpiado");
        } catch (error) {
            console.warn("[Valoraciones] Error al limpiar cache:", error);
        }
    }

    // ========== VALIDACIÓN ==========
    function validarValoracion(datos) {
        const errores = [];

        if (!datos.tallerId) {
            errores.push('El ID del taller es obligatorio');
        }

        if (!datos.estrellas || datos.estrellas < CONFIG.MIN_VALORACION || datos.estrellas > CONFIG.ESTRELLAS_MAX) {
            errores.push(`La valoración debe ser entre ${CONFIG.MIN_VALORACION} y ${CONFIG.ESTRELLAS_MAX} estrellas`);
        }

        if (datos.comentario && datos.comentario.length > CONFIG.MAX_COMENTARIO) {
            errores.push(`El comentario no puede exceder los ${CONFIG.MAX_COMENTARIO} caracteres`);
        }

        if (datos.titulo && datos.titulo.length > CONFIG.MAX_TITULO) {
            errores.push(`El título no puede exceder los ${CONFIG.MAX_TITULO} caracteres`);
        }

        return {
            valido: errores.length === 0,
            errores: errores,
        };
    }

    function sanitizarTexto(texto) {
        if (!texto) return "";
        return String(texto)
            .replace(/[<>]/g, '') // Eliminar etiquetas HTML
            .replace(/\s+/g, ' ') // Normalizar espacios
            .trim();
    }

    // ========== OBTENCIÓN DE VALORACIONES ==========
    async function obtenerValoracionesTaller(tallerId, opciones = {}) {
        if (!tallerId) {
            log("ID de taller no proporcionado");
            return null;
        }

        const { pagina = 1, porPagina = CONFIG.MAX_VALORACIONES, force = false } = opciones;
        const cacheKey = `valoraciones_${tallerId}_${pagina}`;

        if (!force) {
            const cached = cargarCache(cacheKey);
            if (cached) {
                state.valoracionesActuales = cached;
                return cached;
            }
        }

        state.cargando = true;
        state.error = null;

        try {
            const desde = (pagina - 1) * porPagina;
            
            const { data, error, count } = await supabase
                .from('valoraciones')
                .select('*', { count: 'exact' })
                .eq('taller_id', tallerId)
                .eq('activo', true)
                .order('created_at', { ascending: false })
                .range(desde, desde + porPagina - 1);

            if (error) {
                throw error;
            }

            const valoraciones = data || [];
            
            // Enriquecer con datos de usuario
            await enriquecerValoraciones(valoraciones);

            state.valoracionesActuales = valoraciones;
            state.paginacion.pagina = pagina;
            state.paginacion.total = count || 0;
            state.paginacion.porPagina = porPagina;

            guardarCache(cacheKey, valoraciones);
            
            log(`${valoraciones.length} valoraciones obtenidas para taller ${tallerId}`);
            return valoraciones;
        } catch (error) {
            state.error = error.message;
            log("Error al obtener valoraciones:", error);
            return null;
        } finally {
            state.cargando = false;
        }
    }

    // ========== ENRIQUECIMIENTO DE DATOS ==========
    async function enriquecerValoraciones(valoraciones) {
        if (!valoraciones || !valoraciones.length) return;

        const userIds = [...new Set(valoraciones.map(v => v.usuario_id).filter(Boolean))];
        
        if (!userIds.length) return;

        try {
            const { data: usuarios } = await supabase
                .from('usuarios')
                .select('id, nombre, avatar')
                .in('id', userIds);

            if (usuarios) {
                const mapaUsuarios = new Map(usuarios.map(u => [u.id, u]));
                
                valoraciones.forEach(valoracion => {
                    if (valoracion.usuario_id) {
                        const usuario = mapaUsuarios.get(valoracion.usuario_id);
                        if (usuario) {
                            valoracion.usuario_nombre = usuario.nombre;
                            valoracion.usuario_avatar = usuario.avatar;
                        }
                    }
                });
            }
        } catch (error) {
            log("Error al enriquecer valoraciones:", error);
        }
    }

    // ========== ESTADÍSTICAS DE VALORACIONES ==========
    async function obtenerEstadisticasTaller(tallerId) {
        if (!tallerId) return null;

        const cacheKey = `estadisticas_${tallerId}`;
        const cached = cargarCache(cacheKey);
        if (cached) return cached;

        try {
            const { data, error } = await supabase
                .rpc('estadisticas_valoraciones', {
                    p_taller_id: tallerId
                });

            if (error) throw error;

            const estadisticas = data || {
                promedio: 0,
                total: 0,
                distribucion: Array(CONFIG.ESTRELLAS_MAX).fill(0),
            };

            // Calcular distribución
            const { data: distribucion } = await supabase
                .from('valoraciones')
                .select('estrellas, count(*)')
                .eq('taller_id', tallerId)
                .eq('activo', true)
                .groupBy('estrellas');

            if (distribucion) {
                const distribucionMap = new Map(distribucion.map(d => [d.estrellas, d.count]));
                estadisticas.distribucion = Array.from({ length: CONFIG.ESTRELLAS_MAX }, (_, i) => {
                    return distribucionMap.get(i + 1) || 0;
                });
            }

            guardarCache(cacheKey, estadisticas);
            return estadisticas;
        } catch (error) {
            log("Error al obtener estadísticas:", error);
            return null;
        }
    }

    // ========== CREACIÓN DE VALORACIONES ==========
    async function crearValoracion(datos) {
        // Validar
        const validacion = validarValoracion(datos);
        if (!validacion.valido) {
            return {
                exito: false,
                errores: validacion.errores,
            };
        }

        if (state.enviando) {
            return {
                exito: false,
                errores: ['Ya se está enviando una valoración'],
            };
        }

        state.enviando = true;
        state.error = null;

        try {
            // Sanitizar datos
            const valoracion = {
                taller_id: datos.tallerId,
                usuario_id: datos.usuarioId || null,
                estrellas: Math.round(datos.estrellas),
                titulo: sanitizarTexto(datos.titulo || ''),
                comentario: sanitizarTexto(datos.comentario || ''),
                activo: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            // Verificar si ya ha valorado
            if (datos.usuarioId) {
                const { data: existente } = await supabase
                    .from('valoraciones')
                    .select('id')
                    .eq('taller_id', datos.tallerId)
                    .eq('usuario_id', datos.usuarioId)
                    .single();

                if (existente) {
                    // Actualizar valoración existente
                    const { data, error } = await supabase
                        .from('valoraciones')
                        .update(valoracion)
                        .eq('id', existente.id)
                        .select()
                        .single();

                    if (error) throw error;

                    // Invalidar cache
                    limpiarCacheTaller(datos.tallerId);

                    log(`Valoración actualizada para taller ${datos.tallerId}`);
                    return {
                        exito: true,
                        valoracion: data,
                        actualizada: true,
                    };
                }
            }

            // Crear nueva valoración
            const { data, error } = await supabase
                .from('valoraciones')
                .insert(valoracion)
                .select()
                .single();

            if (error) throw error;

            // Invalidar cache
            limpiarCacheTaller(datos.tallerId);

            // Registrar en historial de ratings
            guardarRating(datos.tallerId, datos.estrellas);

            log(`Valoración creada para taller ${datos.tallerId}`);
            return {
                exito: true,
                valoracion: data,
                actualizada: false,
            };
        } catch (error) {
            state.error = error.message;
            log("Error al crear valoración:", error);
            return {
                exito: false,
                errores: [error.message || 'Error al guardar la valoración'],
            };
        } finally {
            state.enviando = false;
        }
    }

    // ========== GESTIÓN DE RATINGS POR USUARIO ==========
    function guardarRating(tallerId, estrellas) {
        try {
            const ratings = JSON.parse(localStorage.getItem(CONFIG.RATING_STORAGE_KEY) || '{}');
            ratings[tallerId] = {
                estrellas: estrellas,
                fecha: Date.now(),
            };
            localStorage.setItem(CONFIG.RATING_STORAGE_KEY, JSON.stringify(ratings));
            state.talleresValorados.set(tallerId, { estrellas, fecha: Date.now() });
        } catch (error) {
            console.warn("[Valoraciones] Error al guardar rating:", error);
        }
    }

    function obtenerRatingUsuario(tallerId) {
        try {
            const ratings = JSON.parse(localStorage.getItem(CONFIG.RATING_STORAGE_KEY) || '{}');
            return ratings[tallerId] || null;
        } catch {
            return null;
        }
    }

    function usuarioYaValoro(tallerId) {
        return state.talleresValorados.has(tallerId) || obtenerRatingUsuario(tallerId) !== null;
    }

    // ========== LIMPIEZA DE CACHE POR TALLER ==========
    function limpiarCacheTaller(tallerId) {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(CONFIG.STORAGE_KEY) && key.includes(tallerId)) {
                    localStorage.removeItem(key);
                }
            });
            log(`Cache limpiado para taller ${tallerId}`);
        } catch (error) {
            console.warn("[Valoraciones] Error al limpiar cache:", error);
        }
    }

    // ========== FUNCIONES DE UI ==========
    function crearHTMLValoracion(valoracion) {
        if (!valoracion) return '';

        const estrellas = generarEstrellasHTML(valoracion.estrellas);
        const fecha = new Date(valoracion.created_at).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        const nombre = valoracion.usuario_nombre || 'Usuario anónimo';
        const avatar = valoracion.usuario_avatar || '👤';
        const titulo = valoracion.titulo ? `<h4>${sanitizarTexto(valoracion.titulo)}</h4>` : '';
        const comentario = valoracion.comentario ? `<p>${sanitizarTexto(valoracion.comentario)}</p>` : '';

        return `
            <div class="valoracion-item" data-valoracion-id="${valoracion.id}">
                <div class="valoracion-header">
                    <div class="valoracion-usuario">
                        <span class="avatar">${avatar}</span>
                        <span class="nombre">${nombre}</span>
                    </div>
                    <div class="valoracion-estrellas">${estrellas}</div>
                    <span class="valoracion-fecha">${fecha}</span>
                </div>
                <div class="valoracion-body">
                    ${titulo}
                    ${comentario}
                </div>
                ${valoracion.respuesta ? `
                    <div class="valoracion-respuesta">
                        <strong>Respuesta del taller:</strong>
                        <p>${sanitizarTexto(valoracion.respuesta)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    function generarEstrellasHTML(estrellas, max = CONFIG.ESTRELLAS_MAX) {
        const estrellasLlenas = Math.floor(estrellas);
        const tieneMedia = estrellas % 1 >= 0.5;
        let html = '';

        for (let i = 1; i <= max; i++) {
            if (i <= estrellasLlenas) {
                html += '<span class="estrella llena">★</span>';
            } else if (i === estrellasLlenas + 1 && tieneMedia) {
                html += '<span class="estrella media">★</span>';
            } else {
                html += '<span class="estrella vacia">☆</span>';
            }
        }

        return html;
    }

    function generarEstrellasSelector(selected = 0, max = CONFIG.ESTRELLAS_MAX) {
        let html = '<div class="estrellas-selector">';
        for (let i = 1; i <= max; i++) {
            const clase = i <= selected ? 'selected' : '';
            html += `
                <span class="estrella-select ${clase}" data-valor="${i}" role="button" tabindex="0">
                    ${i <= selected ? '★' : '☆'}
                </span>
            `;
        }
        html += '</div>';
        return html;
    }

    function crearFormularioValoracion(tallerId, opciones = {}) {
        const { cerrado = false, valoracionExistente = null } = opciones;

        if (cerrado) {
            return `
                <div class="valoracion-formulario cerrado">
                    <p class="mensaje">Las valoraciones están cerradas para este taller</p>
                </div>
            `;
        }

        const estrellasIniciales = valoracionExistente?.estrellas || 0;
        const titulo = valoracionExistente?.titulo || '';
        const comentario = valoracionExistente?.comentario || '';

        return `
            <div class="valoracion-formulario" data-taller-id="${tallerId}">
                <h3>${valoracionExistente ? 'Editar valoración' : 'Valorar este taller'}</h3>
                <div class="form-group">
                    <label>Tu puntuación</label>
                    ${generarEstrellasSelector(estrellasIniciales)}
                </div>
                <div class="form-group">
                    <label for="valoracion-titulo">Título (opcional)</label>
                    <input type="text" id="valoracion-titulo" class="form-control" 
                           maxlength="${CONFIG.MAX_TITULO}" value="${sanitizarTexto(titulo)}"
                           placeholder="Resume tu experiencia">
                </div>
                <div class="form-group">
                    <label for="valoracion-comentario">Comentario</label>
                    <textarea id="valoracion-comentario" class="form-control" 
                              rows="4" maxlength="${CONFIG.MAX_COMENTARIO}"
                              placeholder="Cuéntanos tu experiencia con este taller">${sanitizarTexto(comentario)}</textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-enviar-valoracion" 
                            data-taller-id="${tallerId}">
                        ${valoracionExistente ? 'Actualizar valoración' : 'Enviar valoración'}
                    </button>
                    ${valoracionExistente ? `
                        <button type="button" class="btn-eliminar-valoracion" 
                                data-valoracion-id="${valoracionExistente.id}">
                            Eliminar
                        </button>
                    ` : ''}
                </div>
                <div class="form-mensajes"></div>
            </div>
        `;
    }

    // ========== RENDERIZADO ==========
    function renderizarValoraciones(contenedorId, valoraciones, opciones = {}) {
        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) {
            log(`Contenedor ${contenedorId} no encontrado`);
            return;
        }

        if (!valoraciones || !valoraciones.length) {
            contenedor.innerHTML = `
                <div class="valoraciones-vacio">
                    <p>No hay valoraciones para este taller</p>
                    <p class="subtitulo">Sé el primero en valorar este taller</p>
                </div>
            `;
            return;
        }

        const html = valoraciones.map(crearHTMLValoracion).join('');
        
        contenedor.innerHTML = `
            <div class="valoraciones-lista">
                ${html}
            </div>
            ${opciones.mostrarPaginacion ? renderizarPaginacion() : ''}
        `;
    }

    function renderizarPaginacion() {
        const { pagina, total, porPagina } = state.paginacion;
        const totalPaginas = Math.ceil(total / porPagina);

        if (totalPaginas <= 1) return '';

        let html = '<div class="paginacion-valoraciones">';
        
        if (pagina > 1) {
            html += `<button class="btn-pagina" data-pagina="${pagina - 1}">‹ Anterior</button>`;
        }

        html += `<span class="pagina-actual">${pagina} de ${totalPaginas}</span>`;

        if (pagina < totalPaginas) {
            html += `<button class="btn-pagina" data-pagina="${pagina + 1}">Siguiente ›</button>`;
        }

        html += '</div>';
        return html;
    }

    function renderizarEstadisticas(contenedorId, estadisticas) {
        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) return;

        if (!estadisticas || estadisticas.total === 0) {
            contenedor.innerHTML = `
                <div class="estadisticas-vacio">
                    <p>Aún no hay valoraciones</p>
                </div>
            `;
            return;
        }

        const promedio = estadisticas.promedio || 0;
        const total = estadisticas.total || 0;
        const distribucion = estadisticas.distribucion || Array(CONFIG.ESTRELLAS_MAX).fill(0);

        let html = `
            <div class="estadisticas-valoraciones">
                <div class="resumen">
                    <div class="promedio">
                        <span class="numero">${promedio.toFixed(1)}</span>
                        <span class="estrellas">${generarEstrellasHTML(promedio)}</span>
                    </div>
                    <span class="total">${total} ${total === 1 ? 'valoración' : 'valoraciones'}</span>
                </div>
                <div class="distribucion">
        `;

        distribucion.forEach((count, index) => {
            const estrellas = index + 1;
            const porcentaje = total > 0 ? (count / total) * 100 : 0;
            html += `
                <div class="barra-distribucion">
                    <span class="estrellas-label">${estrellas} ★</span>
                    <div class="barra">
                        <div class="barra-llena" style="width: ${porcentaje}%"></div>
                    </div>
                    <span class="count">${count}</span>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        contenedor.innerHTML = html;
    }

    // ========== EVENTOS ==========
    function inicializarEventos() {
        // Evento para selector de estrellas
        document.addEventListener('click', function(event) {
            const estrella = event.target.closest('.estrella-select');
            if (estrella) {
                const valor = parseInt(estrella.dataset.valor);
                const contenedor = estrella.closest('.estrellas-selector');
                if (contenedor) {
                    // Actualizar selección
                    contenedor.querySelectorAll('.estrella-select').forEach(el => {
                        const v = parseInt(el.dataset.valor);
                        el.classList.toggle('selected', v <= valor);
                        el.textContent = v <= valor ? '★' : '☆';
                    });
                }
            }
        });

        // Evento para enviar valoración
        document.addEventListener('click', async function(event) {
            const btn = event.target.closest('.btn-enviar-valoracion');
            if (!btn) return;

            const tallerId = btn.dataset.tallerId;
            const formulario = btn.closest('.valoracion-formulario');
            
            if (!formulario || !tallerId) return;

            const estrellasSeleccionadas = formulario.querySelectorAll('.estrella-select.selected').length;
            const titulo = formulario.querySelector('#valoracion-titulo')?.value || '';
            const comentario = formulario.querySelector('#valoracion-comentario')?.value || '';
            const mensajes = formulario.querySelector('.form-mensajes');

            // Validar
            if (estrellasSeleccionadas === 0) {
                if (mensajes) {
                    mensajes.innerHTML = '<div class="error">Por favor, selecciona una puntuación</div>';
                }
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Enviando...';

            const resultado = await crearValoracion({
                tallerId: tallerId,
                estrellas: estrellasSeleccionadas,
                titulo: titulo,
                comentario: comentario,
                usuarioId: null, // Se obtendrá automáticamente
            });

            if (resultado.exito) {
                if (mensajes) {
                    mensajes.innerHTML = '<div class="exito">✅ Valoración enviada correctamente</div>';
                }
                
                // Recargar valoraciones
                const valoraciones = await obtenerValoracionesTaller(tallerId, { force: true });
                const contenedor = document.getElementById('valoraciones-lista');
                if (contenedor && valoraciones) {
                    renderizarValoraciones('valoraciones-lista', valoraciones);
                }

                // Recargar estadísticas
                const estadisticas = await obtenerEstadisticasTaller(tallerId);
                const contenedorEstadisticas = document.getElementById('estadisticas-valoraciones');
                if (contenedorEstadisticas && estadisticas) {
                    renderizarEstadisticas('estadisticas-valoraciones', estadisticas);
                }

                // Limpiar formulario
                formulario.querySelector('.estrellas-selector')?.querySelectorAll('.estrella-select').forEach(el => {
                    el.classList.remove('selected');
                    el.textContent = '☆';
                });
                if (formulario.querySelector('#valoracion-titulo')) {
                    formulario.querySelector('#valoracion-titulo').value = '';
                }
                if (formulario.querySelector('#valoracion-comentario')) {
                    formulario.querySelector('#valoracion-comentario').value = '';
                }

                // Mostrar mensaje de éxito
                const mensajeExito = document.createElement('div');
                mensajeExito.className = 'mensaje-exito';
                mensajeExito.textContent = '¡Gracias por tu valoración!';
                formulario.prepend(mensajeExito);
                setTimeout(() => mensajeExito.remove(), 5000);

            } else {
                if (mensajes) {
                    mensajes.innerHTML = `<div class="error">${resultado.errores.join(', ')}</div>`;
                }
            }

            btn.disabled = false;
            btn.textContent = 'Enviar valoración';
        });

        // Evento para paginación
        document.addEventListener('click', async function(event) {
            const btn = event.target.closest('.btn-pagina');
            if (!btn) return;

            const pagina = parseInt(btn.dataset.pagina);
            const tallerId = document.querySelector('.valoracion-formulario')?.dataset.tallerId;
            
            if (!tallerId) return;

            const valoraciones = await obtenerValoracionesTaller(tallerId, { pagina });
            const contenedor = document.getElementById('valoraciones-lista');
            if (contenedor && valoraciones) {
                renderizarValoraciones('valoraciones-lista', valoraciones, { mostrarPaginacion: true });
            }
        });

        // Evento para eliminar valoración
        document.addEventListener('click', async function(event) {
            const btn = event.target.closest('.btn-eliminar-valoracion');
            if (!btn) return;

            const valoracionId = btn.dataset.valoracionId;
            if (!valoracionId) return;

            if (!confirm('¿Estás seguro de que quieres eliminar esta valoración?')) return;

            try {
                const { error } = await supabase
                    .from('valoraciones')
                    .update({ activo: false })
                    .eq('id', valoracionId);

                if (error) throw error;

                const tallerId = document.querySelector('.valoracion-formulario')?.dataset.tallerId;
                if (tallerId) {
                    limpiarCacheTaller(tallerId);
                    const valoraciones = await obtenerValoracionesTaller(tallerId, { force: true });
                    const contenedor = document.getElementById('valoraciones-lista');
                    if (contenedor && valoraciones) {
                        renderizarValoraciones('valoraciones-lista', valoraciones);
                    }
                }

                alert('Valoración eliminada correctamente');
            } catch (error) {
                alert('Error al eliminar la valoración: ' + error.message);
            }
        });
    }

    // ========== EXPOSICIÓN PÚBLICA ==========
    const Valoraciones = {
        CONFIG: CONFIG,
        
        // Estado
        getState: () => ({ ...state }),
        
        // Obtener
        obtenerValoracionesTaller: obtenerValoracionesTaller,
        obtenerEstadisticasTaller: obtenerEstadisticasTaller,
        obtenerRatingUsuario: obtenerRatingUsuario,
        usuarioYaValoro: usuarioYaValoro,
        
        // Crear
        crearValoracion: crearValoracion,
        
        // Cache
        guardarCache: guardarCache,
        cargarCache: cargarCache,
        limpiarCache: limpiarCache,
        limpiarCacheTaller: limpiarCacheTaller,
        
        // UI
        crearHTMLValoracion: crearHTMLValoracion,
        generarEstrellasHTML: generarEstrellasHTML,
        generarEstrellasSelector: generarEstrellasSelector,
        crearFormularioValoracion: crearFormularioValoracion,
        renderizarValoraciones: renderizarValoraciones,
        renderizarEstadisticas: renderizarEstadisticas,
        
        // Validación
        validarValoracion: validarValoracion,
        sanitizarTexto: sanitizarTexto,
        
        // Inicialización
        init: function(tallerId, opciones = {}) {
            log("Inicializando sistema de valoraciones");
            
            // Cargar valoraciones
            if (tallerId) {
                this.obtenerValoracionesTaller(tallerId, opciones).then(valoraciones => {
                    const contenedor = document.getElementById('valoraciones-lista');
                    if (contenedor && valoraciones) {
                        this.renderizarValoraciones('valoraciones-lista', valoraciones, { mostrarPaginacion: true });
                    }
                });

                // Cargar estadísticas
                this.obtenerEstadisticasTaller(tallerId).then(estadisticas => {
                    const contenedor = document.getElementById('estadisticas-valoraciones');
                    if (contenedor && estadisticas) {
                        this.renderizarEstadisticas('estadisticas-valoraciones', estadisticas);
                    }
                });
            }

            inicializarEventos();
            return this;
        }
    };

    // ========== EXPOSICIÓN PÚBLICA ==========
    window.Valoraciones = Valoraciones;
    window.TallerMapValoraciones = Valoraciones;

    // ========== INICIALIZACIÓN ==========
    function iniciar() {
        log("Sistema de valoraciones inicializado");
        
        // Inicializar automáticamente si hay un contenedor
        const contenedor = document.querySelector('[data-valoraciones-taller]');
        if (contenedor) {
            const tallerId = contenedor.dataset.valoracionesTaller;
            if (tallerId) {
                Valoraciones.init(tallerId);
            }
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
})();
