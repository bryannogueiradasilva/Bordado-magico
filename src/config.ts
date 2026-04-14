/**
 * CONFIGURAÇÃO GLOBAL DA API
 * 
 * Este arquivo centraliza a URL base da API para garantir que o frontend
 * funcione corretamente tanto no ambiente do Google Studio (Remix)
 * quanto no deploy final no Cloud Run.
 */

export const API_BASE_URL = "https://remix-bordado-m-gico-matrizes-de-bordado-267339025814.us-west1.run.app";

/**
 * Helper para chamadas fetch que garante o tratamento correto de JSON
 * e logs de debug necessários.
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = API_BASE_URL + endpoint;
  
  // Log de debug para monitorar as chamadas
  console.log(`🌐 API CALL: ${url}`, options.method || 'GET');

  const response = await fetch(url, options);
  
  // Verifica se a resposta é JSON antes de tentar parsear
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const data = await response.json();
    return { data, ok: response.ok, status: response.status };
  }
  
  // Se não for JSON, retorna o texto para debug
  const text = await response.text();
  return { data: text, ok: response.ok, status: response.status, isText: true };
}
