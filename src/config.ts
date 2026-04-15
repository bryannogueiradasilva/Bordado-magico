/**
 * CONFIGURAÇÃO GLOBAL DA API
 * 
 * Este arquivo centraliza a URL base da API para garantir que o frontend
 * funcione corretamente tanto no ambiente do Google Studio (Remix)
 * quanto no deploy final no Cloud Run.
 */

export const API_BASE_URL = 
  window.location.hostname.includes("run.app") 
    ? "" 
    : "https://remix-bordado-m-gico-matrizes-de-bordado-267339025814.us-west1.run.app";

/**
 * Helper para chamadas fetch com timeout para evitar travamentos.
 */
export const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 20000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};
