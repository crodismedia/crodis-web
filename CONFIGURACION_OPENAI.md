# 🔐 Configuración de OpenAI GPT para Desarrollo Local

## 📋 Requisitos

- ✅ Cuenta en [OpenAI Platform](https://platform.openai.com)
- ✅ Créditos disponibles en OpenAI
- ✅ Navegador moderno con JavaScript habilitado

---

## 🔑 Paso 1: Obtener tu API Key

1. Ve a **[https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)**
2. Haz clic en **"Create new secret key"**
3. **Copia la clave** (aparecerá solo UNA VEZ)
4. Guárdala en un lugar seguro

---

## 📝 Paso 2: Configurar el Proyecto

### ✅ Opción A: Archivo config.js (RECOMENDADO)

1. Abre **`js/config.js`** (ya creado)
2. Reemplaza `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` con tu API key real

```javascript
// js/config.js
window.OPENAI_CONFIG = {
  apiKey: 'sk-tu-api-key-aqui' // Reemplaza esto
};
```

3. Asegúrate de que `config.js` esté en `.gitignore` (ya está configurado)

### ✅ Opción B: Entrada Manual en la UI

Si prefieres ingresar la API key manualmente en el navegador:

```html
<!-- En tu HTML -->
<div id="apiConfig">
  <input type="password" id="apiKeyInput" placeholder="Ingresa tu API key de OpenAI">
  <button onclick="setOpenAIKey()">Configurar</button>
  <button onclick="clearOpenAIKey()">Limpiar</button>
</div>

<script>
  function setOpenAIKey() {
    const key = document.getElementById('apiKeyInput').value;
    if (!key.startsWith('sk-')) {
      alert('API key inválida. Debe empezar con sk-');
      return;
    }
    openai.setApiKey(key);
    alert('✅ API key configurada correctamente');
  }

  function clearOpenAIKey() {
    openai.clearApiKey();
    alert('API key eliminada');
  }
</script>
```

---

## 🧪 Paso 3: Usar en tu Código

### Ejemplo Básico: Chat Simple

```javascript
// Hacer una pregunta a GPT
async function chatWithGPT() {
  try {
    const response = await openai.chat('¿Hola, cómo estás?');
    console.log('GPT responde:', response);
    document.getElementById('resultado').innerText = response;
  } catch (error) {
    console.error('Error:', error.message);
    alert('Error: ' + error.message);
  }
}
```

### Ejemplo: Conversación con Historial

```javascript
// Mantener una conversación
let historialConversacion = [];

async function conversacion(mensaje) {
  try {
    const respuesta = await openai.chat(mensaje, historialConversacion);
    
    // Guardar en historial
    historialConversacion.push({ role: 'user', content: mensaje });
    historialConversacion.push({ role: 'assistant', content: respuesta });
    
    console.log('GPT:', respuesta);
    return respuesta;
  } catch (error) {
    console.error('Error:', error);
  }
}

// Uso
await conversacion('¿Cuál es tu nombre?');
await conversacion('¿Cuál es tu color favorito?'); // Recordará la conversación anterior
```

### Ejemplo: Análisis de Texto

```javascript
// Analizar un texto con GPT
async function analizarTexto() {
  const textoAAnalizar = `
    El taller de cerámica es un espacio donde se enseña el arte de la cerámica
    usando técnicas tradicionales y modernas...
  `;
  
  try {
    const analisis = await openai.analyze(
      textoAAnalizar,
      'Resume este texto en 2 frases cortas'
    );
    console.log('Análisis:', analisis);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Ejemplo: Generar Contenido

```javascript
// Generar nombres para un taller
async function generarNombres() {
  try {
    const nombres = await openai.generate(
      'Genera 5 nombres creativos para un taller de cerámica en Valencia'
    );
    console.log('Nombres sugeridos:', nombres);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Generar descripción
async function generarDescripcion() {
  try {
    const descripcion = await openai.generate(
      'Escribe una descripción atractiva para un taller de cerámica dirigido a principiantes'
    );
    console.log('Descripción:', descripcion);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Ejemplo: Validar y Procesar Datos

```javascript
// Procesar formulario con GPT
async function procesarFormulario(datosFormulario) {
  try {
    const prompt = `
      Valida estos datos de taller y sugiere mejoras:
      ${JSON.stringify(datosFormulario, null, 2)}
    `;
    
    const resultado = await openai.generate(prompt);
    console.log('Sugerencias:', resultado);
    return resultado;
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

## ⚠️ Seguridad Importante

### ✅ SI DEBES:
- ✅ Guardar `config.js` en `.gitignore` (ya está hecho)
- ✅ Usar `.env.local` solo para desarrollo local
- ✅ Cambiar tu API key si la expusiste públicamente
- ✅ Revisar tus límites de uso en OpenAI
- ✅ Usar variables de entorno en producción

### ❌ NUNCA DEBES:
- ❌ Hacer commit de la API key a Git
- ❌ Exponer la API key en código frontend en producción
- ❌ Compartir la API key públicamente
- ❌ Usar la misma API key en múltiples proyectos sin control

---

## 📊 Monitorear tu Uso

1. Ve a **[https://platform.openai.com/account/usage](https://platform.openai.com/account/usage)**
2. Verifica créditos y gastos
3. Establece límites si es necesario:
   - [https://platform.openai.com/account/billing/limits](https://platform.openai.com/account/billing/limits)

---

## 🚀 Para Producción (Importante)

En producción, **NUNCA** uses la API key en el frontend. En su lugar:

### Arquitectura Recomendada:
```
Frontend (HTML/JS)
    ↓
Backend (Node.js/Python/etc)
    ↓
OpenAI API
```

### Ejemplo con Node.js + Express:

**Backend (`api/chat.js`):**
```javascript
const express = require('express');
const { OpenAI } = require('openai');

const app = express();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // API key en backend solo
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: message }]
  });
  
  res.json({ reply: response.choices[0].message.content });
});

app.listen(3000);
```

**Frontend (`js/app.js`):**
```javascript
async function chatWithGPT(message) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  
  const data = await response.json();
  console.log('Respuesta:', data.reply);
}
```

---

## 🔧 Troubleshooting

### Error: "API key not configured"
- Verifica que `config.js` esté cargado ANTES de `openai-config.js`
- Verifica que tu API key sea correcta (debe empezar con `sk-`)

### Error: "401 Unauthorized"
- Tu API key es inválida o ha expirado
- Genera una nueva en: https://platform.openai.com/api-keys

### Error: "429 Too Many Requests"
- Has alcanzado el límite de llamadas
- Espera unos minutos antes de intentar de nuevo
- Revisa tus límites: https://platform.openai.com/account/billing/limits

### Error: "Fetch error" o CORS
- En desarrollo local, esto normalmente no ocurre
- En producción, usa tu backend (ve sección "Para Producción")

---

## 📞 Recursos Útiles

- 📖 **Documentación OpenAI:** [https://platform.openai.com/docs](https://platform.openai.com/docs)
- 🔑 **Gestionar API Keys:** [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- 📊 **Monitorear Uso:** [https://platform.openai.com/account/usage](https://platform.openai.com/account/usage)
- 🛑 **Estado de API:** [https://status.openai.com](https://status.openai.com)
- 💬 **Community:** [https://community.openai.com](https://community.openai.com)

---

## ✅ Checklist de Configuración

- [ ] Obtuve mi API key de OpenAI
- [ ] Edité `js/config.js` con mi API key
- [ ] Verifiqué que `.gitignore` contiene `config.js`
- [ ] Cargué `js/config.js` ANTES de `js/openai-config.js` en mi HTML
- [ ] Probé una llamada simple con `openai.chat()`
- [ ] Revisé mi uso en https://platform.openai.com/account/usage

---

**Última actualización:** 2026-07-24  
**Estado:** ✅ Listo para desarrollo local
