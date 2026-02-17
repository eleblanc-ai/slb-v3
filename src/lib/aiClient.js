import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Centralized AI client for Claude and OpenAI API calls
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

/**
 * Call AI with a prompt (text generation)
 * @param {string} prompt - The prompt to send
 * @param {string} model - The model to use (claude-* or gpt-*)
 * @param {number} maxTokens - Maximum tokens to generate
 * @returns {Promise<string>} - The generated text
 */
export async function callAI(prompt, model, maxTokens = 4096) {
  if (model.startsWith('claude')) {
    const response = await anthropic.messages.create({
      model,
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

function chunkTextByParagraphs(text, maxChunkChars) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const para of paragraphs) {
    const p = para.trim();
    if (!p) continue;

    if (p.length > maxChunkChars) {
      // Flush current chunk first
      pushCurrent();

      // Hard-split oversized paragraph
      let start = 0;
      while (start < p.length) {
        const slice = p.substring(start, start + maxChunkChars);
        chunks.push(slice);
        start += maxChunkChars;
      }
      continue;
    }

    if ((current + '\n\n' + p).trim().length > maxChunkChars) {
      pushCurrent();
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }

  pushCurrent();
  return chunks;
}

/**
 * Call AI with prompt batching when context is too large
 * @param {string} prompt - The full prompt
 * @param {string} model - The model to use
 * @param {number} maxTokens - Maximum tokens to generate per batch
 * @param {Object} options - Batching options
 * @param {number} options.maxPromptChars - Max prompt length before batching
 * @param {number} options.maxContextChars - Max context chunk size
 * @returns {Promise<string>} - The combined generated text
 */
export async function callAIWithBatchedContext(
  prompt,
  model,
  maxTokens = 4096,
  options = {}
) {
  const maxPromptChars = options.maxPromptChars || 12000;
  const maxContextChars = options.maxContextChars || 6000;

  if (!prompt || prompt.length <= maxPromptChars) {
    return callAI(prompt, model, maxTokens);
  }

  const contextHeader = '=== CONTEXT ===';
  const contextIndex = prompt.indexOf(contextHeader);

  if (contextIndex === -1) {
    // Fallback: split the whole prompt into batches
    const chunks = chunkTextByParagraphs(prompt, maxPromptChars);
    const responses = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkPrompt = `PART ${i + 1}/${chunks.length}\n\n${chunks[i]}`;
      const result = await callAI(chunkPrompt, model, maxTokens);
      responses.push(result.trim());
    }
    return responses.join('\n\n');
  }

  const header = prompt.slice(0, contextIndex).trimEnd();
  const afterContext = prompt.slice(contextIndex + contextHeader.length).replace(/^\n/, '');

  let contextInstructions = '';
  let contextBody = afterContext.trim();
  const instructionSplit = afterContext.indexOf('\n\n');

  if (instructionSplit !== -1) {
    contextInstructions = afterContext.slice(0, instructionSplit).trim();
    contextBody = afterContext.slice(instructionSplit + 2).trim();
  }

  const contextChunks = chunkTextByParagraphs(contextBody, maxContextChars);

  if (contextChunks.length === 1) {
    return callAI(prompt, model, maxTokens);
  }

  const responses = [];
  for (let i = 0; i < contextChunks.length; i++) {
    const chunkPrompt = `${header}\n\n${contextHeader}\n${contextInstructions}\n\n=== CONTEXT PART ${i + 1}/${contextChunks.length} ===\n${contextChunks[i]}\n\n=== OUTPUT INSTRUCTIONS ===\nReturn only the portion of the final response that corresponds to this context part. Do not repeat content from other parts.`;
    const result = await callAI(chunkPrompt, model, maxTokens);
    responses.push(result.trim());
  }

  return responses.join('\n\n');
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
  if (model.startsWith('claude')) {
    // Claude expects 'input_schema' not 'parameters'
    const claudeSchema = {
      name: functionSchema.name,
      description: functionSchema.description,
      input_schema: functionSchema.parameters || functionSchema.input_schema
    };
    
    const response = await anthropic.messages.create({
      model,
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
export async function generateImage(prompt, size = '1K') {
  const maxPromptLength = 3500;
  let imagePrompt = prompt.length > maxPromptLength 
    ? prompt.substring(0, maxPromptLength) + '...' 
    : prompt;

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
  let attemptCount = 0;
  const maxAttempts = 3;
  
  while (attemptCount < maxAttempts) {
    try {
      attemptCount++;
      
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3-pro-image-preview"
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
                    model: 'gemini-3-pro-image-preview',
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
                  model: 'gemini-3-pro-image-preview',
                  altText: geminiAltText.trim()
                }
              };
            }
          }
        }
      }

      // If we got here, no image data was found
      if (geminiAltText) {
        console.log('⚠️ Gemini returned text instead of image:');
        console.log(geminiAltText);
      }
      console.log('🔍 Full response structure:', JSON.stringify(response, null, 2));
      
      return {
        success: false,
        reason: 'No image data in Gemini response'
      };
      
    } catch (error) {
      const isOverloaded = error.message?.includes('503') || 
                          error.message?.toLowerCase().includes('overloaded') ||
                          error.message?.toLowerCase().includes('quota');
      
      if (attemptCount < maxAttempts && isOverloaded) {
        console.warn(`⚠️ Gemini error, retrying in ${delay / 1000}s... (Attempt ${attemptCount}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, delay));
        delay = Math.min(delay * 1.5, 10000);
        continue;
      }
      
      return { 
        success: false, 
        reason: `Gemini failed after ${attemptCount} attempts: ${error.message}`,
        debugInfo: error
      };
    }
  }
  
  return { success: false, reason: 'Max attempts reached' };
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
