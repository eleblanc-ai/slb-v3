import { supabase } from './supabaseClient';

/**
 * Centralized AI client for Claude, OpenAI and Gemini calls.
 *
 * All provider calls go through the /api/ai serverless function so API keys
 * stay on the server. Nothing in this file may import a provider SDK — doing
 * so would put keys back in the browser bundle.
 */

async function callProxy(action, payload) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
  });

  if (!response.ok) {
    let message = `AI request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // Non-JSON error body; keep the status-based message.
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Call AI with a prompt (text generation)
 * @param {string} prompt - The prompt to send
 * @param {string} model - The model to use (must be an allowlisted Claude model)
 * @param {number} maxTokens - Maximum tokens to generate
 * @returns {Promise<string>} - The generated text
 */
export async function callAI(prompt, model, maxTokens = 4096) {
  const { text } = await callProxy('generate', { prompt, model, maxTokens });
  return text;
}

/**
 * Summarize a passage for image guidance
 * @param {string} passage - The passage to summarize
 * @param {number} maxChars - Maximum character length for the summary
 * @returns {Promise<string|null>} - The summary or null if unavailable
 */
export async function summarizePassageForImage(passage, maxChars = 700) {
  if (!passage) return null;
  const trimmed = passage.trim();
  if (!trimmed) return null;

  try {
    const { summary } = await callProxy('summarize', { passage: trimmed, maxChars });
    return summary || null;
  } catch (error) {
    console.warn('⚠️ Passage summary failed:', error?.message || error);
    return null;
  }
}

/**
 * Call AI with function calling / structured output
 * @param {string} prompt - The prompt to send
 * @param {string} model - The model to use
 * @param {Object} functionSchema - The function/tool schema
 * @returns {Promise<Object>} - The parsed function call result
 */
export async function callAIWithFunction(prompt, model, functionSchema) {
  const { result } = await callProxy('function', { prompt, model, functionSchema });
  return result;
}

/**
 * Generate an image using Gemini 3 Pro Image
 * @param {string} prompt - The image generation prompt
 * @param {string} size - Unused. Retained so existing call sites keep working;
 *                        it only ever configured the removed DALL-E fallback.
 * @returns {Promise<{url: string, model: string, altText: string}>}
 */
export async function generateImage(prompt, size = '1K') {
  void size;
  return callProxy('image', { prompt });
}

/**
 * Generate alt text for an image using GPT-4o Vision
 * @param {string} imageDataUrl - The data URL of the image
 * @returns {Promise<string>} - The generated alt text
 */
export async function generateAltText(imageDataUrl) {
  const { text } = await callProxy('altText', { imageDataUrl });
  return text;
}
