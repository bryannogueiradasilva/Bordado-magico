import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const analyzeEmbroideryImage = async (base64Data: string, mimeType: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: "Analise esta imagem de uma matriz de bordado. Identifique o que está representado e sugira um nome comercial atraente em português, uma categoria (ex: Flores, Infantil, Natal, Animais, Logotipos, etc) e uma breve descrição técnica. Retorne os dados em formato JSON.",
            },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
          },
          required: ["name", "category", "description"],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Erro ao analisar imagem com Gemini:", error);
    return null;
  }
};

export const analyzeEmbroideryFilename = async (filename: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: `Analise o nome deste arquivo de matriz de bordado: "${filename}". 
              Com base apenas no nome, sugira um nome comercial atraente em português, uma categoria (ex: Flores, Infantil, Natal, Animais, Logotipos, etc) e uma breve descrição técnica. 
              Além disso, forneça um "prompt" em inglês para gerar uma imagem que represente fielmente este bordado.
              Retorne os dados em formato JSON.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            imagePrompt: { type: Type.STRING },
          },
          required: ["name", "category", "description", "imagePrompt"],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Erro ao analisar nome de arquivo com Gemini:", error);
    return null;
  }
};

export const generateEmbroideryPreview = async (prompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `TECHNICAL EMBROIDERY SOFTWARE PREVIEW: ${prompt}. 
            Render this as a high-fidelity digital stitch preview from professional software like Wilcom or PE-Design.
            - Background: Neutral light gray or white fabric with a subtle technical grid.
            - Stitches: Visible satin stitches, fill stitches, and running stitches with realistic thread sheen.
            - Details: Show individual thread paths, slight 3D elevation of the embroidery, and realistic thread density.
            - Composition: Perfectly centered, full design visible, no cropping.
            - Style: Flat technical rendering, NO lifestyle elements, NO hands, NO embroidery hoops, NO artistic lighting.
            - Colors: Solid, vibrant thread colors as defined in a digital palette.
            The goal is a 100% faithful technical representation of the digital embroidery file.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Erro ao gerar imagem com Gemini:", error);
    return null;
  }
};
