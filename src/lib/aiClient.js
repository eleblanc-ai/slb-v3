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
 * Generate an image using Gemini 3 Pro Image (with infinite retries)
 * @param {string} prompt - The image generation prompt
 * @param {string} size - Image size (ignored for Gemini)
 * @returns {Promise<{url: string, model: string, altText?: string}>} - The image URL, model used, and optional alt text from Gemini
 */
export async function generateImage(prompt, size = '1024x1024') {
  // Truncate prompt if too long
  const maxPromptLength = 3500; // Leave some buffer
  let imagePrompt = prompt;
  if (imagePrompt.length > maxPromptLength) {
    console.warn(`⚠️ Prompt too long (${imagePrompt.length} chars), truncating to ${maxPromptLength} chars`);
    imagePrompt = imagePrompt.substring(0, maxPromptLength) + '...';
  }

  // Keep retrying with Gemini 3 Pro Image until success
  console.log('🎨 Attempting image generation with Gemini 3 Pro Image (2200x1400)...');
  
  // Retry logic with exponential backoff - will keep retrying indefinitely
  let response;
  let delay = 3000;
  let attemptCount = 0;
  
  while (true) {
    try {
      attemptCount++;
      const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview" });
      response = await model.generateContent(`Create an image at 2200 x 1400 pixels: ${imagePrompt}`);
      break; // Success!
    } catch (error) {
      const isOverloaded = error.message?.includes('503') || error.message?.toLowerCase().includes('overloaded');
      if (isOverloaded) {
        console.warn(`⚠️ Gemini overloaded, Retrying in ${delay / 1000}s... (Attempt ${attemptCount})`);
        await new Promise(r => setTimeout(r, delay));
        delay = Math.min(delay * 1.5, 30000); // Exponential backoff, cap at 30s
        continue;
      }
      // For non-overload errors, still retry but log it
      console.error(`⚠️ Gemini error (Attempt ${attemptCount}):`, error.message);
      console.warn(`Retrying in ${delay / 1000}s...`);
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(delay * 1.5, 30000); // Exponential backoff, cap at 30s
    }
  }

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
                console.log('📝 Gemini alt text:', geminiAltText.substring(0, 200));
                return {
                  url: `data:${mimeType};base64,${base64Data}`,
                  model: 'gemini-3-pro-image-preview',
                  altText: geminiAltText.trim()
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
              console.log('📝 Gemini alt text:', geminiAltText.substring(0, 200));
              return {
                url: `data:${mimeType};base64,${base64Data}`,
                model: 'gemini-3-pro-image-preview',
                altText: geminiAltText.trim()
              };
            }
          }
        }
      }
      
      // If we got here, no image data was found - this shouldn't happen with Gemini
      if (geminiAltText) {
        console.error('❌ Gemini returned text instead of image:');
        console.error(geminiAltText);
        console.error('\n🔍 Full response structure:');
        console.error(JSON.stringify(response, null, 2));
      } else {
        console.error('❌ No image data or text found in response');
        console.error('🔍 Full response structure:');
        console.error(JSON.stringify(response, null, 2));
      }
      throw new Error('Gemini did not return image data in expected format');
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
