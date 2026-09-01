(function () {
    "use strict";

    // ========== DEPENDENCIAS ==========
    if (!window.supabaseClient) {
        console.error("[ReclamarTaller] Dependencia faltante: cliente Supabase");
        return;
    }

    if (!window.TallerMapTallerUrls) {
        console.warn("[ReclamarTaller] Dependencia faltante: taller-urls-core.js");
    }

    // ========== CONFIGURACIÓN ==========
    const CONFIG = {
        DEBUG: false,
        CACHE_DURATION: 3600000, // 1 hora
        STORAGE_KEY: "tallermap_reclamacion_cache",
        MAX_MENSAJE: 1000,
        MAX_TELEFONO: 15,
        MAX_NOMBRE: 100,
        TIMEOUT_SUBMIT: 30000,
        ESTADOS: {
            PENDIENTE: 'pendiente',
            EN_REVISION: 'en_revision',
            APROBADA: 'aprobada',
            RECHAZADA: 'rechazada',
            CADUCADA: 'caducada',
        },
        TIEMPO_VERIFICACION: 30, // días
        TIPO_DOCUMENTO: [
            'cif',
            'nie',
            'nif',
            'pasaporte',
            'otros'
        ]
    };

    // ========== LOGGING ==========
    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log("[ReclamarTaller]", ...args);
        }
    }

    // ========== REFERENCIAS ==========
    const supabase = window.supabaseClient;
    const core = window.TallerMapTallerUrls || {};

    // ========== ESTADO ==========
    const state = {
        tallerActual: null,
        reclamacionActual: null,
        cargando: false,
        enviando: false,
        error: null,
        pasos: {
            actual: 1,
            total: 3,
        },
        datos: {
            tipoDocumento: '',
            numeroDocumento: '',
            nombre: '',
            email: '',
            telefono: '',
            cargo: '',
            mensaje: '',
            aceptaTerminos: false,
            documentosAdjuntos: [],
        },
        documentosSubidos: [],
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
            console.warn("[ReclamarTaller] Error al guardar cache:", error);
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
            console.warn("[ReclamarTaller] Error al cargar cache:", error);
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
            log("Cache de reclamaciones limpiado");
        } catch (error) {
            console.warn("[ReclamarTaller] Error al limpiar cache:", error);
        }
    }

    // ========== VALIDACIÓN ==========
    function validarReclamacion(datos) {
        const errores = [];

        if (!datos.tallerId) {
            errores.push('El ID del taller es obligatorio');
        }

        if (!datos.nombre || datos.nombre.trim().length < 2) {
            errores.push('El nombre completo es obligatorio (mínimo 2 caracteres)');
        }

        if (datos.nombre && datos.nombre.length > CONFIG.MAX_NOMBRE) {
            errores.push(`El nombre no puede exceder los ${CONFIG.MAX_NOMBRE} caracteres`);
        }

        if (!datos.email || !validarEmail(datos.email)) {
            errores.push('Introduce un email válido');
        }

        if (datos.telefono && !validarTelefono(datos.telefono)) {
            errores.push('Introduce un teléfono válido (solo números)');
        }

        if (datos.telefono && datos.telefono.length > CONFIG.MAX_TELEFONO) {
            errores.push(`El teléfono no puede exceder los ${CONFIG.MAX_TELEFONO} caracteres`);
        }

        if (!datos.tipoDocumento) {
            errores.push('Selecciona un tipo de documento');
        }

        if (!datos.numeroDocumento || datos.numeroDocumento.trim().length < 3) {
            errores.push('El número de documento es obligatorio');
        }

        if (!datos.cargo || datos.cargo.trim().length < 2) {
            errores.push('Especifica tu cargo o relación con el taller');
        }

        if (!datos.mensaje || datos.mensaje.trim().length < 20) {
            errores.push('El mensaje debe tener al menos 20 caracteres');
        }

        if (datos.mensaje && datos.mensaje.length > CONFIG.MAX_MENSAJE) {
            errores.push(`El mensaje no puede exceder los ${CONFIG.MAX_MENSAJE} caracteres`);
        }

        if (!datos.aceptaTerminos) {
            errores.push('Debes aceptar los términos y condiciones');
        }

        return {
            valido: errores.length === 0,
            errores: errores,
        };
    }

    function validarEmail(email) {
        if (!email) return false;
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email.trim());
    }

    function validarTelefono(telefono) {
        if (!telefono) return true; // Opcional
        const regex = /^[0-9+\s-]{6,15}$/;
        return regex.test(telefono.trim());
    }

    function sanitizarTexto(texto) {
        if (!texto) return "";
        return String(texto)
            .replace(/[<>]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ========== VERIFICACIÓN DE RECLAMACIÓN EXISTENTE ==========
    async function verificarReclamacionExistente(tallerId, email) {
        if (!tallerId || !email) return null;

        try {
            const { data, error } = await supabase
                .from('reclamaciones_taller')
                .select('*')
                .eq('taller_id', tallerId)
                .eq('email', email)
                .in('estado', [CONFIG.ESTADOS.PENDIENTE, CONFIG.ESTADOS.EN_REVISION])
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;
            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            log("Error al verificar reclamación existente:", error);
            return null;
        }
    }

    async function verificarTallerReclamado(tallerId) {
        if (!tallerId) return null;

        try {
            const { data, error } = await supabase
                .from('reclamaciones_taller')
                .select('*')
                .eq('taller_id', tallerId)
                .eq('estado', CONFIG.ESTADOS.APROBADA)
                .limit(1);

            if (error) throw error;
            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            log("Error al verificar taller reclamado:", error);
            return null;
        }
    }

    // ========== CREACIÓN DE RECLAMACIÓN ==========
    async function crearReclamacion(datos) {
        const validacion = validarReclamacion(datos);
        if (!validacion.valido) {
            return {
                exito: false,
                errores: validacion.errores,
            };
        }

        if (state.enviando) {
            return {
                exito: false,
                errores: ['Ya se está enviando una solicitud'],
            };
        }

        state.enviando = true;
        state.error = null;

        try {
            // Verificar si ya existe una reclamación pendiente
            const existente = await verificarReclamacionExistente(datos.tallerId, datos.email);
            if (existente) {
                return {
                    exito: false,
                    errores: ['Ya has solicitado la reclamación de este taller. Estamos revisando tu solicitud.'],
                    existente: true,
                };
            }

            // Verificar si el taller ya está reclamado
            const reclamado = await verificarTallerReclamado(datos.tallerId);
            if (reclamado) {
                return {
                    exito: false,
                    errores: ['Este taller ya ha sido reclamado y verificado.'],
                };
            }

            // Sanitizar datos
            const reclamacion = {
                taller_id: datos.tallerId,
                tipo_documento: datos.tipoDocumento,
                numero_documento: sanitizarTexto(datos.numeroDocumento),
                nombre: sanitizarTexto(datos.nombre),
                email: datos.email.trim().toLowerCase(),
                telefono: datos.telefono ? sanitizarTexto(datos.telefono) : null,
                cargo: sanitizarTexto(datos.cargo),
                mensaje: sanitizarTexto(datos.mensaje),
                documentos: datos.documentosAdjuntos || [],
                estado: CONFIG.ESTADOS.PENDIENTE,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                expira_en: new Date(Date.now() + CONFIG.TIEMPO_VERIFICACION * 24 * 60 * 60 * 1000).toISOString(),
            };

            const { data, error } = await supabase
                .from('reclamaciones_taller')
                .insert(reclamacion)
                .select()
                .single();

            if (error) throw error;

            // Enviar email de confirmación
            await enviarEmailConfirmacion(data);

            // Guardar en cache
            const cacheKey = `reclamacion_${datos.tallerId}_${datos.email}`;
            guardarCache(cacheKey, data);

            log(`Reclamación creada para taller ${datos.tallerId}`);
            return {
                exito: true,
                reclamacion: data,
            };
        } catch (error) {
            state.error = error.message;
            log("Error al crear reclamación:", error);
            return {
                exito: false,
                errores: [error.message || 'Error al procesar la solicitud'],
            };
        } finally {
            state.enviando = false;
        }
    }

    // ========== SUBIDA DE DOCUMENTOS ==========
    async function subirDocumento(tallerId, archivo, tipo) {
        if (!tallerId || !archivo) {
            return {
                exito: false,
                error: 'Datos incompletos para subir documento',
            };
        }

        const tamañoMax = 5 * 1024 * 1024; // 5MB
        if (archivo.size > tamañoMax) {
            return {
                exito: false,
                error: 'El archivo no puede superar los 5MB',
            };
        }

        const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!tiposPermitidos.includes(archivo.type)) {
            return {
                exito: false,
                error: 'Formato no permitido. Usa PDF, JPG o PNG',
            };
        }

        try {
            const fileName = `reclamacion_${tallerId}_${Date.now()}_${archivo.name}`;
            const filePath = `reclamaciones/${tallerId}/${fileName}`;

            const { data, error } = await supabase.storage
                .from('documentos-reclamacion')
                .upload(filePath, archivo);

            if (error) throw error;

            // Guardar referencia en la base de datos
            const { data: docData, error: docError } = await supabase
                .from('reclamacion_documentos')
                .insert({
                    reclamacion_id: null, // Se asignará después
                    taller_id: tallerId,
                    nombre: archivo.name,
                    ruta: filePath,
                    tipo: tipo || 'documento',
                    tamaño: archivo.size,
                    created_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (docError) throw docError;

            state.documentosSubidos.push(docData);
            
            log(`Documento subido: ${fileName}`);
            return {
                exito: true,
                documento: docData,
            };
        } catch (error) {
            log("Error al subir documento:", error);
            return {
                exito: false,
                error: error.message || 'Error al subir el documento',
            };
        }
    }

    // ========== EMAILS ==========
    async function enviarEmailConfirmacion(reclamacion) {
        try {
            // Esta función se integraría con un servicio de emails
            // Por ahora, solo logueamos
            log(`Email de confirmación enviado a ${reclamacion.email}`);
            
            // Aquí se integraría con SendGrid, Resend, etc.
            // Ejemplo:
            // await fetch('/api/send-email', {
            //     method: 'POST',
            //     body: JSON.stringify({
            //         to: reclamacion.email,
            //         template: 'reclamacion-confirmacion',
            //         data: reclamacion,
            //     }),
            // });
            
            return true;
        } catch (error) {
            log("Error al enviar email:", error);
            return false;
        }
    }

    async function enviarEmailNotificacionAdmin(reclamacion) {
        try {
            log(`Notificación a administradores para taller ${reclamacion.taller_id}`);
            // Integración con email de administradores
            return true;
        } catch (error) {
            log("Error al notificar a administradores:", error);
            return false;
        }
    }

    // ========== OBTENER ESTADO DE RECLAMACIÓN ==========
    async function obtenerEstadoReclamacion(tallerId, email) {
        if (!tallerId || !email) return null;

        const cacheKey = `reclamacion_${tallerId}_${email}`;
        const cached = cargarCache(cacheKey);
        if (cached) return cached;

        try {
            const { data, error } = await supabase
                .from('reclamaciones_taller')
                .select('*')
                .eq('taller_id', tallerId)
                .eq('email', email)
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            const reclamacion = data && data.length > 0 ? data[0] : null;
            
            if (reclamacion) {
                guardarCache(cacheKey, reclamacion);
            }

            return reclamacion;
        } catch (error) {
            log("Error al obtener estado de reclamación:", error);
            return null;
        }
    }

    // ========== ACTUALIZAR RECLAMACIÓN ==========
    async function actualizarReclamacion(id, datos) {
        try {
            const { data, error } = await supabase
                .from('reclamaciones_taller')
                .update({
                    ...datos,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Limpiar cache
            limpiarCache();
            
            log(`Reclamación ${id} actualizada`);
            return {
                exito: true,
                reclamacion: data,
            };
        } catch (error) {
            log("Error al actualizar reclamación:", error);
            return {
                exito: false,
                error: error.message,
            };
        }
    }

    // ========== FUNCIONES DE UI ==========
    function crearHTMLFormulario(taller, opciones = {}) {
        if (!taller) return '<p>Taller no encontrado</p>';

        const { modo = 'completo', pasos = false } = opciones;
        const nombreTaller = taller.nombre || taller.empresa || 'Taller sin nombre';

        if (pasos) {
            return crearFormularioPorPasos(taller);
        }

        return `
            <div class="reclamar-taller-container" data-taller-id="${taller.id}">
                <div class="reclamar-header">
                    <h2>📋 Reclamar taller: ${nombreTaller}</h2>
                    <p>Completa el formulario para verificar tu propiedad del taller</p>
                </div>

                <div class="reclamar-formulario">
                    <div class="form-group">
                        <label>Documento de identidad *</label>
                        <select id="tipo-documento" class="form-control">
                            <option value="">Selecciona...</option>
                            ${CONFIG.TIPO_DOCUMENTO.map(tipo => 
                                `<option value="${tipo}">${tipo.toUpperCase()}</option>`
                            ).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Número de documento *</label>
                        <input type="text" id="numero-documento" class="form-control" 
                               placeholder="Ej: 12345678A" maxlength="20">
                    </div>

                    <div class="form-group">
                        <label>Nombre completo *</label>
                        <input type="text" id="nombre-completo" class="form-control" 
                               placeholder="Tu nombre y apellidos" maxlength="${CONFIG.MAX_NOMBRE}">
                    </div>

                    <div class="form-group">
                        <label>Email de contacto *</label>
                        <input type="email" id="email-contacto" class="form-control" 
                               placeholder="tucorreo@ejemplo.com">
                    </div>

                    <div class="form-group">
                        <label>Teléfono de contacto</label>
                        <input type="tel" id="telefono-contacto" class="form-control" 
                               placeholder="600 123 456" maxlength="${CONFIG.MAX_TELEFONO}">
                    </div>

                    <div class="form-group">
                        <label>Cargo o relación con el taller *</label>
                        <input type="text" id="cargo-taller" class="form-control" 
                               placeholder="Ej: Propietario, Gerente, Encargado">
                    </div>

                    <div class="form-group">
                        <label>Mensaje *</label>
                        <textarea id="mensaje-reclamacion" class="form-control" 
                                  rows="5" maxlength="${CONFIG.MAX_MENSAJE}"
                                  placeholder="Explica tu relación con el taller y por qué deseas reclamarlo"></textarea>
                    </div>

                    <div class="form-group">
                        <label>Documentos adjuntos</label>
                        <div class="drop-zone" id="drop-zone">
                            <p>📁 Arrastra tus documentos aquí o haz clic para seleccionar</p>
                            <input type="file" id="documentos-input" multiple accept=".pdf,.jpg,.jpeg,.png">
                        </div>
                        <div id="documentos-lista" class="documentos-lista"></div>
                    </div>

                    <div class="form-group check">
                        <label>
                            <input type="checkbox" id="acepta-terminos">
                            Acepto los <a href="/terminos" target="_blank">términos y condiciones</a> *
                        </label>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn-enviar-reclamacion" id="enviar-reclamacion">
                            📤 Enviar solicitud
                        </button>
                    </div>

                    <div class="form-mensajes" id="form-mensajes"></div>
                </div>
            </div>
        `;
    }

    function crearFormularioPorPasos(taller) {
        const nombreTaller = taller.nombre || taller.empresa || 'Taller sin nombre';

        return `
            <div class="reclamar-taller-container" data-taller-id="${taller.id}">
                <div class="reclamar-header">
                    <h2>📋 Reclamar taller: ${nombreTaller}</h2>
                    <div class="pasos-indicador">
                        ${[1, 2, 3].map(paso => `
                            <div class="paso ${paso <= state.pasos.actual ? 'activo' : ''}">
                                <span class="numero">${paso}</span>
                                <span class="label">${paso === 1 ? 'Identificación' : paso === 2 ? 'Verificación' : 'Confirmación'}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="reclamar-formulario-pasos">
                    ${renderizarPaso(taller)}
                </div>
            </div>
        `;
    }

    function renderizarPaso(taller) {
        const paso = state.pasos.actual;

        switch(paso) {
            case 1:
                return `
                    <div class="paso-contenido" data-paso="1">
                        <h3>Paso 1: Identificación</h3>
                        <div class="form-group">
                            <label>Documento de identidad *</label>
                            <select id="tipo-documento" class="form-control">
                                <option value="">Selecciona...</option>
                                ${CONFIG.TIPO_DOCUMENTO.map(tipo => 
                                    `<option value="${tipo}">${tipo.toUpperCase()}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Número de documento *</label>
                            <input type="text" id="numero-documento" class="form-control" 
                                   placeholder="Ej: 12345678A" maxlength="20">
                        </div>
                        <div class="form-group">
                            <label>Nombre completo *</label>
                            <input type="text" id="nombre-completo" class="form-control" 
                                   placeholder="Tu nombre y apellidos" maxlength="${CONFIG.MAX_NOMBRE}">
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-siguiente-paso" data-paso="2">
                                Siguiente →
                            </button>
                        </div>
                    </div>
                `;
            case 2:
                return `
                    <div class="paso-contenido" data-paso="2">
                        <h3>Paso 2: Verificación</h3>
                        <div class="form-group">
                            <label>Email de contacto *</label>
                            <input type="email" id="email-contacto" class="form-control" 
                                   placeholder="tucorreo@ejemplo.com">
                        </div>
                        <div class="form-group">
                            <label>Teléfono de contacto</label>
                            <input type="tel" id="telefono-contacto" class="form-control" 
                                   placeholder="600 123 456" maxlength="${CONFIG.MAX_TELEFONO}">
                        </div>
                        <div class="form-group">
                            <label>Cargo o relación con el taller *</label>
                            <input type="text" id="cargo-taller" class="form-control" 
                                   placeholder="Ej: Propietario, Gerente, Encargado">
                        </div>
                        <div class="form-group">
                            <label>Documentos adjuntos</label>
                            <div class="drop-zone" id="drop-zone">
                                <p>📁 Arrastra tus documentos aquí o haz clic para seleccionar</p>
                                <input type="file" id="documentos-input" multiple accept=".pdf,.jpg,.jpeg,.png">
                            </div>
                            <div id="documentos-lista" class="documentos-lista"></div>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-paso-anterior" data-paso="1">
                                ← Anterior
                            </button>
                            <button type="button" class="btn-siguiente-paso" data-paso="3">
                                Siguiente →
                            </button>
                        </div>
                    </div>
                `;
            case 3:
                return `
                    <div class="paso-contenido" data-paso="3">
                        <h3>Paso 3: Confirmación</h3>
                        <div class="form-group">
                            <label>Mensaje *</label>
                            <textarea id="mensaje-reclamacion" class="form-control" 
                                      rows="5" maxlength="${CONFIG.MAX_MENSAJE}"
                                      placeholder="Explica tu relación con el taller y por qué deseas reclamarlo"></textarea>
                        </div>
                        <div class="form-group check">
                            <label>
                                <input type="checkbox" id="acepta-terminos">
                                Acepto los <a href="/terminos" target="_blank">términos y condiciones</a> *
                            </label>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-paso-anterior" data-paso="2">
                                ← Anterior
                            </button>
                            <button type="button" class="btn-enviar-reclamacion" id="enviar-reclamacion">
                                📤 Enviar solicitud
                            </button>
                        </div>
                    </div>
                `;
            default:
                return '<p>Paso no encontrado</p>';
        }
    }

    function crearHTMLExito(reclamacion) {
        return `
            <div class="reclamar-exito">
                <div class="icono">✅</div>
                <h2>¡Solicitud enviada con éxito!</h2>
                <p>Hemos recibido tu solicitud de reclamación del taller.</p>
                <div class="detalles">
                    <p><strong>Número de solicitud:</strong> #${reclamacion.id}</p>
                    <p><strong>Estado:</strong> ${reclamacion.estado}</p>
                    <p><strong>Fecha:</strong> ${new Date(reclamacion.created_at).toLocaleDateString('es-ES')}</p>
                </div>
                <p class="info-extra">Te contactaremos en un plazo de ${CONFIG.TIEMPO_VERIFICACION} días hábiles.</p>
                <button type="button" class="btn-volver" onclick="window.location.href='/taller/${reclamacion.taller_id}'">
                    Volver al taller
                </button>
            </div>
        `;
    }

    function crearHTMLError(errores) {
        const listaErrores = Array.isArray(errores) 
            ? errores.map(err => `<li>${err}</li>`).join('')
            : `<li>${errores}</li>`;

        return `
            <div class="reclamar-error">
                <div class="icono">❌</div>
                <h3>Error en la solicitud</h3>
                <ul>${listaErrores}</ul>
                <button type="button" class="btn-intentar-nuevamente">
                    Intentar nuevamente
                </button>
            </div>
        `;
    }

    function crearHTMLEstado(reclamacion) {
        const estados = {
            pendiente: '⏳ Pendiente de revisión',
            en_revision: '🔍 En revisión',
            aprobada: '✅ Aprobada',
            rechazada: '❌ Rechazada',
            caducada: '⏰ Caducada',
        };

        const colores = {
            pendiente: '#f39c12',
            en_revision: '#3498db',
            aprobada: '#27ae60',
            rechazada: '#e74c3c',
            caducada: '#95a5a6',
        };

        return `
            <div class="reclamar-estado" style="border-left-color: ${colores[reclamacion.estado] || '#ccc'}">
                <div class="estado-header">
                    <span class="estado-icono">${Object.keys(estados).find(k => k === reclamacion.estado) || '📋'}</span>
                    <span class="estado-texto" style="color: ${colores[reclamacion.estado] || '#333'}">
                        ${estados[reclamacion.estado] || reclamacion.estado}
                    </span>
                </div>
                <div class="estado-detalles">
                    <p><strong>Solicitud:</strong> #${reclamacion.id}</p>
                    <p><strong>Fecha:</strong> ${new Date(reclamacion.created_at).toLocaleDateString('es-ES')}</p>
                    ${reclamacion.fecha_revision ? `<p><strong>Revisión:</strong> ${new Date(reclamacion.fecha_revision).toLocaleDateString('es-ES')}</p>` : ''}
                    ${reclamacion.motivo_rechazo ? `<p><strong>Motivo:</strong> ${reclamacion.motivo_rechazo}</p>` : ''}
                </div>
            </div>
        `;
    }

    // ========== RENDERIZADO ==========
    function renderizarFormulario(contenedorId, taller, opciones = {}) {
        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) {
            log(`Contenedor ${contenedorId} no encontrado`);
            return;
        }

        const html = crearHTMLFormulario(taller, opciones);
        contenedor.innerHTML = html;
        
        // Inicializar eventos del formulario
        inicializarEventosFormulario(contenedorId);
    }

    function renderizarEstado(contenedorId, reclamacion) {
        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) return;

        const html = crearHTMLEstado(reclamacion);
        contenedor.innerHTML = html;
    }

    // ========== EVENTOS ==========
    function inicializarEventosFormulario(contenedorId) {
        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) return;

        // Drop zone para documentos
        const dropZone = contenedor.querySelector('#drop-zone');
        const inputFile = contenedor.querySelector('#documentos-input');
        
        if (dropZone && inputFile) {
            dropZone.addEventListener('click', () => inputFile.click());
            
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                if (e.dataTransfer.files.length) {
                    manejarSubidaDocumentos(e.dataTransfer.files, contenedor);
                }
            });
            
            inputFile.addEventListener('change', (e) => {
                if (e.target.files.length) {
                    manejarSubidaDocumentos(e.target.files, contenedor);
                }
            });
        }

        // Navegación por pasos
        contenedor.querySelectorAll('.btn-siguiente-paso').forEach(btn => {
            btn.addEventListener('click', function() {
                const paso = parseInt(this.dataset.paso);
                if (validarPasoActual(paso - 1, contenedor)) {
                    state.pasos.actual = paso;
                    const tallerId = contenedor.dataset.tallerId;
                    const taller = state.tallerActual;
                    if (taller) {
                        const nuevoHTML = crearFormularioPorPasos(taller);
                        contenedor.innerHTML = nuevoHTML;
                        inicializarEventosFormulario(contenedorId);
                    }
                }
            });
        });

        contenedor.querySelectorAll('.btn-paso-anterior').forEach(btn => {
            btn.addEventListener('click', function() {
                const paso = parseInt(this.dataset.paso);
                state.pasos.actual = paso;
                const tallerId = contenedor.dataset.tallerId;
                const taller = state.tallerActual;
                if (taller) {
                    const nuevoHTML = crearFormularioPorPasos(taller);
                    contenedor.innerHTML = nuevoHTML;
                    inicializarEventosFormulario(contenedorId);
                }
            });
        });

        // Enviar reclamación
        const btnEnviar = contenedor.querySelector('#enviar-reclamacion');
        if (btnEnviar) {
            btnEnviar.addEventListener('click', async function() {
                await manejarEnvioReclamacion(contenedor);
            });
        }

        // Intentar nuevamente en caso de error
        contenedor.querySelector('.btn-intentar-nuevamente')?.addEventListener('click', function() {
            const tallerId = contenedor.dataset.tallerId;
            const taller = state.tallerActual;
            if (taller) {
                renderizarFormulario(contenedorId, taller);
            }
        });
    }

    function validarPasoActual(paso, contenedor) {
        // Validar campos del paso actual
        let valido = true;
        const mensajes = [];

        const campos = contenedor.querySelectorAll(`.paso-contenido[data-paso="${paso}"] [required]`);
        campos.forEach(campo => {
            if (!campo.value || campo.value.trim() === '') {
                campo.classList.add('error');
                valido = false;
                mensajes.push(`El campo ${campo.placeholder || campo.id} es obligatorio`);
            } else {
                campo.classList.remove('error');
            }
        });

        if (!valido) {
            const mensajesContainer = contenedor.querySelector('.form-mensajes');
            if (mensajesContainer) {
                mensajesContainer.innerHTML = `<div class="error">${mensajes.join('<br>')}</div>`;
            }
        }

        return valido;
    }

    async function manejarSubidaDocumentos(files, contenedor) {
        const tallerId = contenedor.dataset.tallerId;
        const lista = contenedor.querySelector('#documentos-lista');
        
        for (const file of files) {
            const resultado = await subirDocumento(tallerId, file);
            
            if (resultado.exito) {
                const item = document.createElement('div');
                item.className = 'documento-item';
                item.innerHTML = `
                    <span>📄 ${file.name}</span>
                    <span class="tamaño">${(file.size / 1024).toFixed(1)} KB</span>
                    <button type="button" class="eliminar-documento" data-doc-id="${resultado.documento.id}">✕</button>
                `;
                lista.appendChild(item);
            } else {
                alert(`Error al subir ${file.name}: ${resultado.error}`);
            }
        }
    }

    async function manejarEnvioReclamacion(contenedor) {
        const tallerId = contenedor.dataset.tallerId;
        const mensajes = contenedor.querySelector('#form-mensajes');

        // Recoger datos del formulario
        const datos = {
            tallerId: tallerId,
            tipoDocumento: contenedor.querySelector('#tipo-documento')?.value || '',
            numeroDocumento: contenedor.querySelector('#numero-documento')?.value || '',
            nombre: contenedor.querySelector('#nombre-completo')?.value || '',
            email: contenedor.querySelector('#email-contacto')?.value || '',
            telefono: contenedor.querySelector('#telefono-contacto')?.value || '',
            cargo: contenedor.querySelector('#cargo-taller')?.value || '',
            mensaje: contenedor.querySelector('#mensaje-reclamacion')?.value || '',
            aceptaTerminos: contenedor.querySelector('#acepta-terminos')?.checked || false,
            documentosAdjuntos: state.documentosSubidos.map(d => d.id),
        };

        const resultado = await crearReclamacion(datos);

        if (resultado.exito) {
            // Mostrar mensaje de éxito
            const htmlExito = crearHTMLExito(resultado.reclamacion);
            contenedor.innerHTML = htmlExito;
        } else {
            // Mostrar errores
            const htmlError = crearHTMLError(resultado.errores);
            if (mensajes) {
                mensajes.innerHTML = htmlError;
            } else {
                const errorContainer = document.createElement('div');
                errorContainer.className = 'form-mensajes';
                errorContainer.innerHTML = htmlError;
                contenedor.querySelector('.reclamar-formulario')?.prepend(errorContainer);
            }
        }
    }

    // ========== FUNCIÓN PRINCIPAL ==========
    async function iniciarReclamacion(tallerId, contenedorId) {
        if (!tallerId) {
            log("ID de taller no proporcionado");
            return;
        }

        try {
            // Obtener datos del taller
            const { data: taller, error } = await supabase
                .from('talleres')
                .select('*')
                .eq('id', tallerId)
                .single();

            if (error) throw error;

            if (!taller) {
                log("Taller no encontrado");
                return;
            }

            state.tallerActual = taller;

            // Verificar si el taller ya está reclamado
            const reclamado = await verificarTallerReclamado(tallerId);
            if (reclamado) {
                const contenedor = document.getElementById(contenedorId);
                if (contenedor) {
                    contenedor.innerHTML = `
                        <div class="reclamar-taller-container">
                            <div class="reclamar-header">
                                <h2>📋 Taller ya reclamado</h2>
                                <p>Este taller ya ha sido reclamado y verificado por su propietario.</p>
                            </div>
                        </div>
                    `;
                }
                return;
            }

            // Renderizar formulario
            renderizarFormulario(contenedorId, taller, { pasos: true });

        } catch (error) {
            log("Error al iniciar reclamación:", error);
            const contenedor = document.getElementById(contenedorId);
            if (contenedor) {
                contenedor.innerHTML = `
                    <div class="reclamar-error">
                        <p>Error al cargar la información del taller</p>
                        <button onclick="window.ReclamarTaller.iniciarReclamacion('${tallerId}', '${contenedorId}')">
                            Reintentar
                        </button>
                    </div>
                `;
            }
        }
    }

    // ========== EXPOSICIÓN PÚBLICA ==========
    const ReclamarTaller = {
        CONFIG: CONFIG,
        
        // Estado
        getState: () => ({ ...state }),
        
        // Validación
        validarReclamacion: validarReclamacion,
        validarEmail: validarEmail,
        validarTelefono: validarTelefono,
        sanitizarTexto: sanitizarTexto,
        
        // Verificación
        verificarReclamacionExistente: verificarReclamacionExistente,
        verificarTallerReclamado: verificarTallerReclamado,
        obtenerEstadoReclamacion: obtenerEstadoReclamacion,
        
        // CRUD
        crearReclamacion: crearReclamacion,
        actualizarReclamacion: actualizarReclamacion,
        
        // Documentos
        subirDocumento: subirDocumento,
        
        // UI
        crearHTMLFormulario: crearHTMLFormulario,
        crearHTMLExito: crearHTMLExito,
        crearHTMLError: crearHTMLError,
        crearHTMLEstado: crearHTMLEstado,
        renderizarFormulario: renderizarFormulario,
        renderizarEstado: renderizarEstado,
        
        // Inicialización
        iniciarReclamacion: iniciarReclamacion,
        
        // Cache
        guardarCache: guardarCache,
        cargarCache: cargarCache,
        limpiarCache: limpiarCache,
    };

    // ========== EXPOSICIÓN PÚBLICA ==========
    window.ReclamarTaller = ReclamarTaller;
    window.TallerMapReclamarTaller = ReclamarTaller;

    // ========== INICIALIZACIÓN ==========
    function iniciar() {
        log("Sistema de reclamación de talleres inicializado");
        
        // Inicializar automáticamente si hay un contenedor
        const contenedor = document.querySelector('[data-reclamar-taller]');
        if (contenedor) {
            const tallerId = contenedor.dataset.reclamarTaller;
            if (tallerId) {
                ReclamarTaller.iniciarReclamacion(tallerId, contenedor.id || 'reclamar-taller-container');
            }
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }
})();
