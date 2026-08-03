/**
 * Server-side AI proxy.
 *
 * All provider API keys live here, read from unprefixed environment variables
 * so Vite cannot inline them into the browser bundle. The browser talks to this
 * endpoint via src/services/aiClient.js and never sees a key.
 *
 * Every request must carry a valid Supabase session token, otherwise this
 * endpoint would be an open relay for the account's AI quota.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// ─── Model allowlist ──────────────────────────────────────────────────
// Only these may be requested by a caller. Mirrors ModelSelector.jsx, but
// enforced here so a hand-crafted request cannot pick an arbitrary model.
const TEXT_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5'];

const CLAUDE_ALIASES = {
  'claude-sonnet-4-20250514': 'claude-sonnet-4-5',
  'claude-sonnet-4-6': 'claude-sonnet-4-5',
};

const ALT_TEXT_MODEL = 'gpt-4o';
const SUMMARY_MODEL = 'gpt-3.5-turbo';
const GEMINI_IMAGE_MODEL = 'gemini-3-pro-image-preview';
const MAX_IMAGE_PROMPT = 3500;

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
    this.status = 400;
  }
}

function normalizeModelId(model) {
  if (!model || typeof model !== 'string') return model;
  return CLAUDE_ALIASES[model] || model;
}

function resolveTextModel(model) {
  const resolved = normalizeModelId(model);
  if (!TEXT_MODELS.includes(resolved)) {
    throw new BadRequestError(`Model not allowed: ${model}`);
  }
  return resolved;
}

function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new BadRequestError(`Missing required field: ${name}`);
  }
  return value;
}

// ─── Lazily constructed clients ───────────────────────────────────────
let anthropicClient = null;
let openaiClient = null;
let googleClient = null;
let supabaseClient = null;

function anthropic() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function openai() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function google() {
  if (!googleClient) {
    googleClient = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  }
  return googleClient;
}

function supabase() {
  if (!supabaseClient) {
    // Accept either name. The app's variables carry the VITE_ prefix because
    // the browser needs them, and Vercel exposes every project variable to
    // functions regardless of prefix — but fall back to unprefixed names so a
    // rename can never silently turn every request into a 401.
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error(
        'Supabase config missing: set SUPABASE_URL and SUPABASE_ANON_KEY (or the VITE_ prefixed equivalents)',
      );
    }
    supabaseClient = createClient(url, anonKey);
  }
  return supabaseClient;
}

// ─── Auth ─────────────────────────────────────────────────────────────
function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}

async function verifyUser(req) {
  const token = bearerToken(req);
  if (!token) return null;

  const { data, error } = await supabase().auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * A valid session is not sufficient — signup was open at one point, so
 * accounts exist that were never approved. Confirm the caller is on the
 * allowlist before spending any AI quota.
 *
 * Uses a request-scoped client so auth.jwt() resolves to the caller inside
 * the SECURITY DEFINER function.
 */
async function isAllowlisted(req) {
  const token = bearerToken(req);
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  const scoped = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await scoped.rpc('is_current_user_allowed');
  if (error) throw new Error(`Allowlist check failed: ${error.message}`);
  return data === true;
}

// ─── Providers ────────────────────────────────────────────────────────
async function generateText({ prompt, model, maxTokens }) {
  const response = await anthropic().messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].text;
}

async function callFunction({ prompt, model, functionSchema }) {
  const response = await anthropic().messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
    tools: [{
      name: functionSchema.name,
      description: functionSchema.description,
      input_schema: functionSchema.parameters || functionSchema.input_schema,
    }],
    tool_choice: { type: 'tool', name: functionSchema.name },
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse) throw new Error('No tool use in Claude response');
  return toolUse.input;
}

/** Walk Gemini's response shape and pull out the first inline image plus any text. */
function extractGeminiImage(response) {
  const roots = [response, response?.response, response?.result].filter(Boolean);
  let altText = '';

  for (const root of roots) {
    const partGroups = [];
    const candidates = root.candidates || root.response?.candidates;

    if (Array.isArray(candidates) && candidates.length > 0) {
      const candidate = candidates[0];
      partGroups.push(candidate.content?.parts || candidate.parts);
    }
    if (Array.isArray(root.parts)) partGroups.push(root.parts);

    for (const parts of partGroups) {
      if (!Array.isArray(parts)) continue;
      for (const part of parts) {
        if (part.text) altText += part.text;
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          return {
            url: `data:${mimeType};base64,${part.inlineData.data}`,
            model: GEMINI_IMAGE_MODEL,
            altText: altText.trim(),
          };
        }
      }
    }
  }
  return null;
}

async function generateImage(prompt) {
  const trimmed = prompt.length > MAX_IMAGE_PROMPT
    ? `${prompt.substring(0, MAX_IMAGE_PROMPT)}...`
    : prompt;

  let delay = 3000;
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const model = google().getGenerativeModel({ model: GEMINI_IMAGE_MODEL });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: trimmed }] }],
        generationConfig: { responseModalities: ['image', 'text'] },
      });

      const image = extractGeminiImage(await result.response);
      if (image) return image;
      lastError = new Error('No image data in Gemini response');
    } catch (error) {
      lastError = error;
      const retryable = error.message?.includes('503')
        || error.message?.toLowerCase().includes('overloaded')
        || error.message?.toLowerCase().includes('quota');
      if (attempt < 3 && retryable) {
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 1.5, 10000);
        continue;
      }
      break;
    }
  }

  throw new Error(`Image generation failed: ${lastError?.message || 'unknown error'}`);
}

async function generateAltText(imageDataUrl) {
  const base64Data = imageDataUrl.split(',')[1];
  const response = await openai().chat.completions.create({
    model: ALT_TEXT_MODEL,
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Describe this educational image in 1-2 concise sentences for alt text. Focus on the main subject and educational content.',
        },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Data}` } },
      ],
    }],
  });
  return response.choices[0].message.content;
}

async function summarize(passage, maxChars) {
  const safePassage = passage.length > 6000 ? passage.substring(0, 6000) : passage;

  const response = await openai().chat.completions.create({
    model: SUMMARY_MODEL,
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content: `Summarize passages for guiding cover image creation. Output plain text only. Keep it vivid and concrete. Limit to ${maxChars} characters or fewer.`,
      },
      { role: 'user', content: `Passage:\n${safePassage}\n\nSummary (<=${maxChars} chars):` },
    ],
  });

  const summary = response.choices?.[0]?.message?.content?.trim() || '';
  return summary.length > maxChars ? summary.substring(0, maxChars).trim() : summary;
}

// ─── Dispatch ─────────────────────────────────────────────────────────
async function dispatch(body) {
  switch (body.action) {
    case 'generate': {
      const prompt = required(body.prompt, 'prompt');
      const model = resolveTextModel(body.model);
      const text = await generateText({ prompt, model, maxTokens: body.maxTokens ?? 4096 });
      return { text };
    }
    case 'function': {
      const prompt = required(body.prompt, 'prompt');
      const functionSchema = required(body.functionSchema, 'functionSchema');
      const model = resolveTextModel(body.model);
      const result = await callFunction({ prompt, model, functionSchema });
      return { result };
    }
    case 'image':
      return await generateImage(required(body.prompt, 'prompt'));
    case 'altText': {
      const text = await generateAltText(required(body.imageDataUrl, 'imageDataUrl'));
      return { text };
    }
    case 'summarize': {
      const passage = required(body.passage, 'passage');
      const summary = await summarize(passage, body.maxChars ?? 700);
      return { summary };
    }
    default:
      throw new BadRequestError(`Unknown action: ${body.action}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let user;
  try {
    user = await verifyUser(req);
  } catch (error) {
    // Misconfiguration, not a bad caller. Say so plainly instead of
    // returning 401 and sending someone hunting for an auth bug.
    return res.status(500).json({ error: error.message || 'Auth check failed' });
  }

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (!(await isAllowlisted(req))) {
      return res.status(403).json({ error: 'Account not permitted to use AI features' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Allowlist check failed' });
  }

  try {
    return res.status(200).json(await dispatch(req.body || {}));
  } catch (error) {
    const status = error instanceof BadRequestError ? 400 : 502;
    // Provider messages are forwarded so failures stay debuggable. SDK errors
    // do not contain the API key, so this does not leak credentials.
    return res.status(status).json({ error: error.message || 'Request failed' });
  }
}
