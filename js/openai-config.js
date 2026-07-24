/**
 * Configuración y cliente de OpenAI para desarrollo local
 * 
 * IMPORTANTE: Esta es una solución SOLO para desarrollo local.
 * Para producción, las llamadas a OpenAI deben hacerse desde el backend.
 */

class OpenAIClient {
  constructor() {
    // En desarrollo local, carga desde un archivo config.js que NO está en git
    // Alternativamente, puedes pasar la API key directamente
    this.apiKey = this.getApiKey();
    this.model = 'gpt-4o-mini';
    this.baseURL = 'https://api.openai.com/v1';
  }

  /**
   * Obtener API key de forma segura (solo desarrollo local)
   * Carga desde window.OPENAI_CONFIG o config.js
   */
  getApiKey() {
    // Opción 1: Desde variable global (cargar config.js manualmente)
    if (window.OPENAI_CONFIG && window.OPENAI_CONFIG.apiKey) {
      return window.OPENAI_CONFIG.apiKey;
    }
    
    // Opción 2: Desde localStorage (solo si el usuario la ingresa en la UI)
    const storedKey = localStorage.getItem('openai_api_key');
    if (storedKey) {
      return storedKey;
    }

    throw new Error('API key de OpenAI no configurada. Ver instrucciones en js/openai-config.js');
  }

  /**
   * Realizar una llamada a Chat Completions de OpenAI
   * @param {string} userMessage - Mensaje del usuario
   * @param {Array} conversationHistory - Historial de conversación (opcional)
   * @returns {Promise<string>} Respuesta de GPT
   */
  async chat(userMessage, conversationHistory = []) {
    try {
      const messages = [
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Error de OpenAI: ${error.error.message}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error en OpenAI:', error);
      throw error;
    }
  }

  /**
   * Analizar texto con GPT
   * @param {string} text - Texto a analizar
   * @param {string} instruction - Instrucción para el análisis
   * @returns {Promise<string>} Análisis de GPT
   */
  async analyze(text, instruction = 'Analiza el siguiente texto:') {
    const message = `${instruction}\n\n${text}`;
    return this.chat(message);
  }

  /**
   * Generar contenido con GPT
   * @param {string} prompt - Prompt para generar contenido
   * @returns {Promise<string>} Contenido generado
   */
  async generate(prompt) {
    return this.chat(prompt);
  }

  /**
   * Establecer API key manualmente (para ingreso en UI)
   * @param {string} apiKey - Clave API de OpenAI
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
    localStorage.setItem('openai_api_key', apiKey);
  }

  /**
   * Limpiar API key almacenada
   */
  clearApiKey() {
    localStorage.removeItem('openai_api_key');
    this.apiKey = null;
  }
}

// Crear instancia global
const openai = new OpenAIClient();
