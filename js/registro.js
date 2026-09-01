(function() {
    "use strict";

    // ============ CONFIGURACIÓN ============
    const CONFIG = {
        DEBUG: false,
        TIMEOUT: 30000, // 30 segundos
        MAX_INTENTOS: 3
    };

    // ============ UTILIDADES ============
    function log(...args) {
        if (CONFIG.DEBUG) {
            console.log("[Registro]", ...args);
        }
    }

    function mostrarError(mensaje, campo = null) {
        const alerta = document.createElement("div");
        alerta.className = "alerta-error";
        alerta.textContent = mensaje;
        alerta.setAttribute("role", "alert");
        
        if (campo) {
            campo.classList.add("campo-error");
            campo.parentNode.insertBefore(alerta, campo.nextSibling);
        } else {
            const form = document.getElementById("registro-taller");
            if (form) {
                form.prepend(alerta);
            }
        }

        setTimeout(() => {
            alerta.remove();
            if (campo) {
                campo.classList.remove("campo-error");
            }
        }, 5000);
    }

    function mostrarExito(mensaje) {
        const alerta = document.createElement("div");
        alerta.className = "alerta-exito";
        alerta.textContent = mensaje;
        alerta.setAttribute("role", "status");
        
        const form = document.getElementById("registro-taller");
        if (form) {
            form.prepend(alerta);
            // Ocultar el formulario si es éxito
            form.querySelector(".formulario-contenido")?.style.setProperty("display", "none");
        }

        setTimeout(() => {
            alerta.remove();
        }, 8000);
    }

    // ============ VALIDACIONES ============
    function validarNIF(cif) {
        if (!cif) return false;
        const cleaned = cif.toUpperCase().replace(/[-\s]/g, "");
        
        // NIF (DNI)
        if (/^[0-9]{8}[A-Z]$/.test(cleaned)) {
            const letras = "TRWAGMYFPDXBNJZSQVHLCKE";
            const numero = parseInt(cleaned.slice(0, 8));
            const letra = cleaned.slice(8);
            return letras[numero % 23] === letra;
        }
        
        // CIF (Empresa)
        if (/^[ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-J]$/.test(cleaned)) {
            const letra = cleaned[0];
            const digitos = cleaned.slice(1, 8);
            const control = cleaned[8];
            
            let suma = 0;
            for (let i = 0; i < 7; i++) {
                const digito = parseInt(digitos[i]);
                if (i % 2 === 0) {
                    const duplicado = digito * 2;
                    suma += duplicado > 9 ? duplicado - 9 : duplicado;
                } else {
                    suma += digito;
                }
            }
            const cifControl = (10 - (suma % 10)) % 10;
            
            if (["A", "B", "E", "H"].includes(letra)) {
                return control === String.fromCharCode(64 + cifControl);
            } else {
                return control === String(cifControl);
            }
        }
        
        // NIE
        if (/^[XYZ][0-9]{7}[A-Z]$/.test(cleaned)) {
            const letras = "TRWAGMYFPDXBNJZSQVHLCKE";
            const prefijo = { X: "0", Y: "1", Z: "2" };
            const numero = parseInt(prefijo[cleaned[0]] + cleaned.slice(1, 8));
            return letras[numero % 23] === cleaned[8];
        }
        
        return false;
    }

    function validarEmail(email) {
        if (!email) return false;
        const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!regex.test(email)) return false;
        
        // Validar dominios comunes
        const dominio = email.split("@")[1]?.toLowerCase();
        const dominiosBloqueados = ["mailinator.com", "temp-mail.org", "guerrillamail.com"];
        if (dominiosBloqueados.includes(dominio)) {
            return false;
        }
        
        return true;
    }

    function validarTelefono(telefono) {
        if (!telefono) return false;
        const cleaned = telefono.replace(/[\s\-().]/g, "");
        
        // España: 9 dígitos
        if (/^[6789][0-9]{8}$/.test(cleaned)) {
            return true;
        }
        
        // Con prefijo internacional
        if (/^\+34[6789][0-9]{8}$/.test(cleaned)) {
            return true;
        }
        
        return false;
    }

    function validarCodigoPostal(cp) {
        if (!cp) return false;
        const cleaned = cp.replace(/[-\s]/g, "");
        return /^[0-9]{5}$/.test(cleaned);
    }

    function validarNombre(nombre) {
        if (!nombre) return false;
        const cleaned = nombre.trim();
        return cleaned.length >= 2 && cleaned.length <= 100;
    }

    function validarWeb(web) {
        if (!web) return true; // Opcional
        try {
            const url = new URL(web);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch (_) {
            return false;
        }
    }

    // ============ VALIDAR FORMULARIO COMPLETO ============
    function validarFormulario(datos) {
        const errores = [];

        // Nombre del taller
        if (!validarNombre(datos.nombre)) {
            errores.push({
                campo: "nombre",
                mensaje: "El nombre del taller debe tener entre 2 y 100 caracteres"
            });
        }

        // CIF/NIF
        if (!validarNIF(datos.cif)) {
            errores.push({
                campo: "cif",
                mensaje: "CIF/NIF no válido. Formato: 12345678A o A12345678"
            });
        }

        // Email
        if (!validarEmail(datos.email)) {
            errores.push({
                campo: "email",
                mensaje: "Email no válido. Introduce un email real"
            });
        }

        // Teléfono
        if (!validarTelefono(datos.telefono)) {
            errores.push({
                campo: "telefono",
                mensaje: "Teléfono no válido. Formato: 912345678 o +34912345678"
            });
        }

        // Dirección
        if (!datos.direccion || datos.direccion.trim().length < 5) {
            errores.push({
                campo: "direccion",
                mensaje: "La dirección debe tener al menos 5 caracteres"
            });
        }

        // Ciudad
        if (!datos.ciudad || datos.ciudad.trim().length < 2) {
            errores.push({
                campo: "ciudad",
                mensaje: "La ciudad es obligatoria"
            });
        }

        // Provincia
        if (!datos.provincia || datos.provincia.trim().length < 2) {
            errores.push({
                campo: "provincia",
                mensaje: "La provincia es obligatoria"
            });
        }

        // Código Postal (si se proporciona)
        if (datos.cp && !validarCodigoPostal(datos.cp)) {
            errores.push({
                campo: "cp",
                mensaje: "Código postal no válido. Formato: 28001"
            });
        }

        // Web (si se proporciona)
        if (datos.web && !validarWeb(datos.web)) {
            errores.push({
                campo: "web",
                mensaje: "La URL web no es válida. Incluye http:// o https://"
            });
        }

        return errores;
    }

    // ============ ENVÍO DEL FORMULARIO ============
    async function enviarFormulario(datos, intento = 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

        try {
            log("Enviando formulario, intento:", intento);
            
            const response = await fetch("/api/registro-taller", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "",
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: JSON.stringify(datos),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            log("Respuesta:", data);
            
            return { success: true, data };

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === "AbortError") {
                return { 
                    success: false, 
                    error: "Tiempo de espera agotado. Intenta de nuevo." 
                };
            }

            if (intento < CONFIG.MAX_INTENTOS) {
                log("Reintentando...");
                return enviarFormulario(datos, intento + 1);
            }

            return { 
                success: false, 
                error: error.message || "Error al enviar el formulario" 
            };
        }
    }

    // ============ MANEJADOR PRINCIPAL ============
    function manejarRegistro(e) {
        e.preventDefault();
        e.stopPropagation();

        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const datos = {};

        // Deshabilitar botón para prevenir doble envío
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Enviando...";
        }

        try {
            // Recopilar datos
            const campos = form.querySelectorAll("input, textarea, select");
            campos.forEach(campo => {
                if (campo.name) {
                    datos[campo.name] = campo.value;
                }
            });

            // Validar
            const errores = validarFormulario(datos);
            
            if (errores.length > 0) {
                // Mostrar primer error
                const primerError = errores[0];
                const campo = document.querySelector(`[name="${primerError.campo}"]`);
                mostrarError(primerError.mensaje, campo);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Registrar taller";
                }
                
                // Mover al campo con error
                if (campo) {
                    campo.focus();
                    campo.scrollIntoView({ behavior: "smooth", block: "center" });
                }
                return;
            }

            // Enviar
            enviarFormulario(datos).then(resultado => {
                if (resultado.success) {
                    mostrarExito("¡Taller registrado correctamente! Revisa tu email para confirmar.");
                    form.reset();
                    
                    // Guardar en localStorage para recuperación
                    try {
                        localStorage.setItem("registro-ultimo-taller", JSON.stringify(datos));
                    } catch (_) {
                        // Ignorar
                    }
                } else {
                    mostrarError(resultado.error);
                }
            }).catch(error => {
                mostrarError("Error inesperado: " + error.message);
            }).finally(() => {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Registrar taller";
                }
            });

        } catch (error) {
            mostrarError("Error al procesar el formulario");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Registrar taller";
            }
            log("Error:", error);
        }
    }

    // ============ RESTAURAR DATOS GUARDADOS ============
    function restaurarDatosGuardados() {
        try {
            const guardado = localStorage.getItem("registro-ultimo-taller");
            if (guardado) {
                const datos = JSON.parse(guardado);
                const form = document.getElementById("registro-taller");
                if (form) {
                    Object.entries(datos).forEach(([nombre, valor]) => {
                        const campo = form.querySelector(`[name="${nombre}"]`);
                        if (campo) {
                            campo.value = valor;
                        }
                    });
                    log("Datos restaurados");
                }
            }
        } catch (_) {
            // Ignorar
        }
    }

    // ============ AUTOCOMPLETAR POR GEOLOCALIZACIÓN ============
    function autocompletarDireccion() {
        if (!navigator.geolocation) return;

        const ciudadInput = document.querySelector('[name="ciudad"]');
        if (!ciudadInput || ciudadInput.value) return;

        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json&accept-language=es`
                );
                const data = await response.json();
                
                if (data.address) {
                    const ciudad = data.address.city || data.address.town || data.address.village;
                    const provincia = data.address.state || data.address.region;
                    const cp = data.address.postcode;
                    
                    if (ciudad) {
                        const input = document.querySelector('[name="ciudad"]');
                        if (input && !input.value) input.value = ciudad;
                    }
                    if (provincia) {
                        const input = document.querySelector('[name="provincia"]');
                        if (input && !input.value) input.value = provincia;
                    }
                    if (cp) {
                        const input = document.querySelector('[name="cp"]');
                        if (input && !input.value) input.value = cp;
                    }
                    
                    log("Autocompletado por geolocalización");
                }
            } catch (_) {
                // Ignorar errores
            }
        }, () => {
            // Usuario denegó permisos
            log("Geolocalización denegada");
        });
    }

    // ============ INICIALIZACIÓN ============
    function inicializar() {
        const form = document.getElementById("registro-taller");
        if (!form) {
            log("Formulario de registro no encontrado");
            return;
        }

        log("Inicializando registro.js");

        // Evento principal
        form.addEventListener("submit", manejarRegistro);

        // Validación en tiempo real
        form.querySelectorAll("input, textarea, select").forEach(campo => {
            campo.addEventListener("blur", () => {
                if (campo.value && !campo.classList.contains("campo-error")) {
                    // Validación básica en tiempo real
                    const nombre = campo.name;
                    let valido = true;
                    
                    if (nombre === "email" && !validarEmail(campo.value)) valido = false;
                    if (nombre === "telefono" && !validarTelefono(campo.value)) valido = false;
                    if (nombre === "cif" && !validarNIF(campo.value)) valido = false;
                    if (nombre === "cp" && campo.value && !validarCodigoPostal(campo.value)) valido = false;
                    
                    campo.classList.toggle("campo-valid", valido);
                    campo.classList.toggle("campo-error", !valido && campo.value);
                }
            });
        });

        // Restaurar datos
        restaurarDatosGuardados();

        // Autocompletar dirección
        if (document.querySelector('[name="ciudad"]:not([value])')) {
            autocompletarDireccion();
        }

        log("Registro.js inicializado correctamente");
    }

    // ============ EJECUCIÓN ============
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", inicializar, { once: true });
    } else {
        inicializar();
    }

    // ============ EXPORTAR (para pruebas) ============
    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            validarNIF,
            validarEmail,
            validarTelefono,
            validarCodigoPostal,
            validarFormulario,
            enviarFormulario
        };
    }

})();
