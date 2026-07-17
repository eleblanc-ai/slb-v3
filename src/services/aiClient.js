import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Centralized AI client for Claude and OpenAI API calls.
 * Calls SDKs directly from the browser for speed.
 */

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true
});

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);

function normalizeModelId(model) {
  if (!model || typeof model !== 'string') return model;

  const claudeAliases = {
    'claude-sonnet-4-20250514': 'claude-sonnet-4-5',
    'claude-sonnet-4-6': 'claude-sonnet-4-5',
  };

  return claudeAliases[model] || model;
}

/**
 * Call AI with a prompt (text generation)
 * @param {string} prompt - The prompt to send
 * @param {string} model - The model to use (claude-* or gpt-*)
 * @param {number} maxTokens - Maximum tokens to generate
 * @returns {Promise<string>} - The generated text
 */
export async function callAI(prompt, model, maxTokens = 4096) {
  const resolvedModel = normalizeModelId(model);

  if (resolvedModel.startsWith('claude')) {
    const response = await anthropic.messages.create({
      model: resolvedModel,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });
    return response.content[0].text;
  } else {
    // For GPT models
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens
    });
    return response.choices[0].message.content;
  }
}

/**
 * Summarize a passage for image guidance using GPT-3.5
 * @param {string} passage - The passage to summarize
 * @param {number} maxChars - Maximum character length for the summary
 * @returns {Promise<string|null>} - The summary or null if unavailable
 */
export async function summarizePassageForImage(passage, maxChars = 700) {
  if (!passage || !import.meta.env.VITE_OPENAI_API_KEY) return null;

  const trimmed = passage.trim();
  if (!trimmed) return null;

  const safePassage = trimmed.length > 6000 ? trimmed.substring(0, 6000) : trimmed;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Summarize passages for guiding cover image creation. Output plain text only. Keep it vivid and concrete. Limit to ${maxChars} characters or fewer.`
        },
        {
          role: 'user',
          content: `Passage:\n${safePassage}\n\nSummary (<=${maxChars} chars):`
        }
      ],
      max_tokens: 300
    });

    let summary = response.choices?.[0]?.message?.content?.trim() || '';
    if (!summary) return null;
    if (summary.length > maxChars) {
      summary = summary.substring(0, maxChars).trim();
    }
    return summary;
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
  const resolvedModel = normalizeModelId(model);

  if (resolvedModel.startsWith('claude')) {
    // Claude expects 'input_schema' not 'parameters'
    const claudeSchema = {
      name: functionSchema.name,
      description: functionSchema.description,
      input_schema: functionSchema.parameters || functionSchema.input_schema
    };
    
    const response = await anthropic.messages.create({
      model: resolvedModel,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      tools: [claudeSchema],
      tool_choice: { type: 'tool', name: functionSchema.name }
    });

    const toolUse = response.content.find(block => block.type === 'tool_use');
    if (!toolUse) throw new Error('No tool use in Claude response');
    return toolUse.input;
  } else {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      functions: [functionSchema],
      function_call: { name: functionSchema.name },
      max_tokens: 4096
    });

    if (!response.choices[0].message.function_call) {
      throw new Error('No function call in OpenAI response');
    }
    return JSON.parse(response.choices[0].message.function_call.arguments);
  }
}

/**
 * Generate an image using Gemini 3 Pro Image (with DALL-E 3 fallback)
 * @param {string} prompt - The image generation prompt
 * @param {string} size - Image size (ignored for Gemini, used for DALL-E fallback)
 * @returns {Promise<{url: string, model: string, altText?: string}>} - The image URL, model used, and optional alt text from Gemini
 */
// Fast image model — ~5-6s vs ~16-18s for gemini-3-pro-image, which is plenty
// for lesson cover images where speed matters more than fidelity.
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

// A fixed visual anchor keeps images consistent run-to-run, pushes a realistic
// photographic look (not the glossy "AI" look), and stops the model from
// rendering text into the picture. Applied to every provider.
const IMAGE_STYLE_DIRECTIVE =
  'Create a realistic, natural-looking photograph with a single clear focal ' +
  'subject and a clean composition. Style: documentary / editorial photography, ' +
  'natural lighting, true-to-life colors, realistic textures, and natural depth ' +
  'of field, as if shot on a DSLR camera. Avoid illustration, 3D render, CGI, ' +
  'cartoon, painting, over-saturated colors, or a glossy "AI-generated" look. ' +
  'Do not render any text, words, letters, numbers, labels, captions, or ' +
  'watermarks anywhere in the image.';

function buildImagePrompt(prompt) {
  const maxTotal = 3500;
  const cleaned = (prompt || '').replace(/\s+/g, ' ').trim();
  const room = maxTotal - IMAGE_STYLE_DIRECTIVE.length - 20;
  const scene = cleaned.length > room
    ? cleaned.slice(0, room).replace(/\s+\S*$/, '') + '…'
    : cleaned;
  return `${IMAGE_STYLE_DIRECTIVE}\n\nScene to depict: ${scene}`;
}

export async function generateImage(prompt, size = '1K') {
  const imagePrompt = buildImagePrompt(prompt);

  // Attempt Gemini first if key exists
  if (import.meta.env.VITE_GOOGLE_API_KEY) {
    const geminiResult = await attemptGeminiGeneration(imagePrompt, size);
    if (geminiResult.success) {
      return geminiResult.data;
    }
    
    // Log the actual failure reason
    console.warn('🔄 Gemini failed:', geminiResult.reason, '→ Using DALL-E');
    if (geminiResult.debugInfo) {
      console.debug('Debug info:', geminiResult.debugInfo);
    }
  }

  // Fallback to DALL-E
  return await generateWithDallE(imagePrompt);
}

/**
 * Attempt to generate image with Gemini 3 Pro Image
 * @private
 */
async function attemptGeminiGeneration(prompt, size) {
  console.log('🎨 Attempting image generation with Gemini 3 Pro Image...');
  
  let delay = 3000;
  const maxAttempts = 3;
  let lastReason = 'Unknown error';
  let lastDebug = null;

  for (let attemptCount = 1; attemptCount <= maxAttempts; attemptCount++) {
    try {

      const model = genAI.getGenerativeModel({
        model: GEMINI_IMAGE_MODEL
      });
      
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ["image", "text"]
        }
      });
      
      const response = await result.response;
      
      console.log('📦 Gemini response received');
      
      // Extract image data from response - handle multiple response formats
      let base64Data = null;
      let geminiAltText = '';

      // Try to get the actual response from various wrapper levels
      const possibleResponses = [
        response,
        response.response,
        response.result
      ].filter(r => r);
      
      for (const resp of possibleResponses) {
        // Check for candidates array
        const candidates = resp.candidates || resp.response?.candidates;
        
        if (candidates && Array.isArray(candidates) && candidates.length > 0) {
          const candidate = candidates[0];
          const parts = candidate.content?.parts || candidate.parts;
          
          if (parts && Array.isArray(parts)) {
            for (const part of parts) {
              // Collect text (Gemini's alt text description)
              if (part.text) {
                geminiAltText += part.text;
              }
              
              // Check for inline image data
              if (part.inlineData?.data) {
                base64Data = part.inlineData.data;
                const mimeType = part.inlineData.mimeType || 'image/png';
                console.log('✅ Image generated successfully with Gemini 3 Pro Image');
                console.log('📷 Image format:', mimeType);
                if (geminiAltText) {
                  console.log('📝 Gemini alt text:', geminiAltText.substring(0, 200));
                }
                return {
                  success: true,
                  data: {
                    url: `data:${mimeType};base64,${base64Data}`,
                    model: GEMINI_IMAGE_MODEL,
                    altText: geminiAltText.trim()
                  }
                };
              }
            }
          }
        }
        
        // Also check direct parts array (some SDK versions)
        if (resp.parts && Array.isArray(resp.parts)) {
          for (const part of resp.parts) {
            // Collect text (Gemini's alt text description)
            if (part.text) {
              geminiAltText += part.text;
            }
            
            if (part.inlineData?.data) {
              base64Data = part.inlineData.data;
              const mimeType = part.inlineData.mimeType || 'image/png';
              console.log('✅ Image generated successfully with Gemini 3 Pro Image');
              console.log('📷 Image format:', mimeType);
              if (geminiAltText) {
                console.log('📝 Gemini alt text:', geminiAltText.substring(0, 200));
              }
              return {
                success: true,
                data: {
                  url: `data:${mimeType};base64,${base64Data}`,
                  model: GEMINI_IMAGE_MODEL,
                  altText: geminiAltText.trim()
                }
              };
            }
          }
        }
      }

      // If we got here, no image data was found. The Gemini image-preview model
      // often returns text-only — treat that as a retryable failure, not an
      // instant fallback to DALL-E (that is the main source of instability).
      if (geminiAltText) {
        console.log('⚠️ Gemini returned text instead of image:');
        console.log(geminiAltText);
      }
      lastReason = 'No image data in Gemini response';

    } catch (error) {
      const msg = (error.message || '').toLowerCase();
      const isTransient = ['503', '500', '429', 'overloaded', 'quota', 'rate',
        'timeout', 'timed out', 'fetch', 'network', 'unavailable', 'internal']
        .some(t => msg.includes(t));
      lastReason = `Gemini error: ${error.message}`;
      lastDebug = error;

      // Permanent errors (bad model, auth, bad request) won't fix themselves —
      // stop retrying and fall back to DALL-E immediately.
      if (!isTransient) {
        return { success: false, reason: lastReason, debugInfo: lastDebug };
      }
    }

    // This attempt failed with a retryable condition (no image, or a transient
    // error). Back off and retry while attempts remain.
    if (attemptCount < maxAttempts) {
      console.warn(`⚠️ Gemini attempt ${attemptCount}/${maxAttempts} failed (${lastReason}); retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 1.5, 10000);
    }
  }

  return {
    success: false,
    reason: `Gemini failed after ${maxAttempts} attempts: ${lastReason}`,
    debugInfo: lastDebug
  };
}

/**
 * Generate image with DALL-E 3
 * @private
 */
async function generateWithDallE(prompt) {
  console.log('🎨 Generating with DALL-E 3...');
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: prompt,
    n: 1,
    size: '1024x1024',
    response_format: 'b64_json'
  });

  console.log('✅ DALL-E generation successful');
  return {
    url: `data:image/png;base64,${response.data[0].b64_json}`,
    model: 'dall-e-3'
  };
}

/**
 * Generate alt text for an image using GPT-4o Vision
 * @param {string} imageDataUrl - The data URL of the image (data:image/png;base64,...)
 * @returns {Promise<string>} - The generated alt text
 */
export async function generateAltText(imageDataUrl) {
  // Extract base64 data from data URL
  const base64Data = imageDataUrl.split(',')[1];

  const visionResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this educational image in 1-2 concise sentences for alt text. Focus on the main subject and educational content.' },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64Data}`
            }
          }
        ]
      }
    ],
    max_tokens: 150
  });

  return visionResponse.choices[0].message.content;
}
