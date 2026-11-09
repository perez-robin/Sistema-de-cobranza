import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));

// Initialize Google Gen AI SDK
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({ apiKey });
}

// Endpoint for OCR scanning of Guatemalan DPI
app.post('/api/ocr-dpi', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Falta la imagen' });
    }

    if (!aiClient) {
      const freshKey = process.env.GEMINI_API_KEY;
      if (freshKey) {
        aiClient = new GoogleGenAI({ apiKey: freshKey });
      }
    }

    if (!aiClient) {
      return res.status(503).json({
        error: 'Servicio de IA no disponible en este momento. Puede ingresar el nombre y DPI manualmente.',
      });
    }

    // Clean base64 data URL prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType,
              },
            },
            {
              text: `Esta es una fotografía de un Documento Personal de Identificación (DPI) de la República de Guatemala.
Extrae con precisión:
1. "cui": El Código Único de Identificación de 13 dígitos numéricos (suele verse en tres grupos como '1234 56789 0101'). Devuélvelo como 13 dígitos seguidos, o vacío si no se puede leer.
2. "nombre": Los nombres y apellidos completos de la persona (en formato Nombre Propio, por ejemplo 'Juan Carlos Pérez López'), o vacío si no se puede leer.
3. "lugar": Municipio o departamento de vecindad si es legible, o vacío.

Responde ÚNICAMENTE un objeto JSON válido con las claves "cui", "nombre" y "lugar". No incluyas markdown, no incluyas comillas invertidas (\`\`\`).`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Fallback regex extraction if model returned wrapped text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      data = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    }

    return res.json({
      success: true,
      data: {
        cui: data.cui || '',
        nombre: data.nombre || '',
        lugar: data.lugar || '',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error desconocido al procesar DPI';
    console.error('Error en /api/ocr-dpi:', errorMsg);
    return res.status(500).json({ error: errorMsg });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Development mode with Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Tu Crédito Móvil backend corriendo en el puerto ${PORT}`);
  });
}

startServer();
