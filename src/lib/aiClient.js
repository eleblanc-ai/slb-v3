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
 * @returns {Promise<{url: string, model: string}>} - The image URL and model used
 */
export async function generateImage(prompt, size = '1024x1024') {
  // Truncate prompt if too long (DALL-E has 4000 char limit)
  const maxPromptLength = 3500; // Leave some buffer
  let imagePrompt = prompt;
  if (imagePrompt.length > maxPromptLength) {
    console.warn(`⚠️ Prompt too long (${imagePrompt.length} chars), truncating to ${maxPromptLength} chars`);
    imagePrompt = imagePrompt.substring(0, maxPromptLength) + '...';
  }

  // Try Gemini 3 Pro Image first
  if (import.meta.env.VITE_GOOGLE_API_KEY) {
    try {
      console.log('🎨 Attempting image generation with Gemini 3 Pro Image (2200x1400)...');
      
      // Add retry logic for overloaded model (common with preview models)
      let response;
      const retries = 3;
      let delay = 3000;
      
      for (let i = 0; i < retries; i++) {
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview" });
          response = await model.generateContent(`Create an image at 2200 x 1400 pixels: ${imagePrompt}`);
          break; // Success!
        } catch (error) {
          const isOverloaded = error.message?.includes('503') || error.message?.toLowerCase().includes('overloaded');
          if (isOverloaded && i < retries - 1) {
            console.warn(`⚠️ Gemini overloaded, Retrying in ${delay / 1000}s... (Attempt ${i + 1}/${retries})`);
            await new Promise(r => setTimeout(r, delay));
            delay *= 1.5; // Exponential backoff
            continue;
          }
          throw error;
        }
      }

      console.log('📦 Gemini response received');
      console.log('🔍 Full Gemini response object:', JSON.stringify(response, null, 2));
      
      // Extract image data from response
      // The SDK wraps the response, so we need to access response.response
      const actualResponse = response.response || response;
      let base64Data = null;
      let textResponse = '';
      
      if (actualResponse.candidates?.[0]?.content?.parts) {
        for (const part of actualResponse.candidates[0].content.parts) {
          if (part.text) {
            textResponse += part.text;
            console.log('📝 Gemini returned text (first 200 chars):', part.text.substring(0, 200));
          } else if (part.inlineData?.data) {
            base64Data = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            console.log('✅ Image generated successfully with Gemini 3 Pro Image');
            console.log('📷 Image format:', mimeType);
            return {
              url: `data:${mimeType};base64,${base64Data}`,
              model: 'gemini-3-pro-image-preview'
            };
          }
        }
      }
      
      if (textResponse) {
        console.log('⚠️ Gemini returned text instead of image. Full response:');
        console.log(textResponse);
      }
      console.log('⚠️ Falling back to DALL-E 3');
    } catch (geminiError) {
      console.error('⚠️  Gemini error:', geminiError.message);
      console.log('Falling back to DALL-E 3...');
    }
  }

  // Fallback to DALL-E 3
  console.log('🎨 Generating image with DALL-E 3...');
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: imagePrompt,
    n: 1,
    size,
    quality: 'standard',
    response_format: 'b64_json' // Use base64 to avoid CORS issues
  });

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
