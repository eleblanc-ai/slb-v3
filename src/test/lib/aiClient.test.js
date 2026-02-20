import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── SDK mocks (hoisted so they're available inside vi.mock factories) ──
const {
  mockAnthropicCreate,
  mockOpenAIChatCreate,
  mockOpenAIImagesGenerate,
  mockGeminiGenerateContent,
} = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn(),
  mockOpenAIChatCreate: vi.fn(),
  mockOpenAIImagesGenerate: vi.fn(),
  mockGeminiGenerateContent: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    constructor() {
      this.messages = { create: mockAnthropicCreate };
    }
  },
}));

vi.mock('openai', () => ({
  default: class {
    constructor() {
      this.chat = { completions: { create: mockOpenAIChatCreate } };
      this.images = { generate: mockOpenAIImagesGenerate };
    }
  },
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGeminiGenerateContent };
    }
  },
}));

// ─── Import after mocks are set up ─────────────────────────────────
import {
  callAI,
  callAIWithFunction,
  generateImage,
  generateAltText,
  summarizePassageForImage,
} from '../../services/aiClient';

beforeEach(() => {
  mockAnthropicCreate.mockReset();
  mockOpenAIChatCreate.mockReset();
  mockOpenAIImagesGenerate.mockReset();
  mockGeminiGenerateContent.mockReset();
});

// ─── callAI ──────────────────────────────────────────────────────────
describe('callAI', () => {
  it('uses Anthropic SDK for Claude models', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ text: 'Hello from Claude!' }],
    });

    const result = await callAI('Say hello', 'claude-sonnet-4-20250514');

    expect(mockAnthropicCreate).toHaveBeenCalledWith({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: 'Say hello' }],
    });
    expect(result).toBe('Hello from Claude!');
  });

  it('uses OpenAI SDK for GPT models', async () => {
    mockOpenAIChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello from GPT!' } }],
    });

    const result = await callAI('Say hello', 'gpt-4o');

    expect(mockOpenAIChatCreate).toHaveBeenCalledWith({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 4096,
    });
    expect(result).toBe('Hello from GPT!');
  });

  it('uses custom maxTokens when specified', async () => {
    mockOpenAIChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hi' } }],
    });

    await callAI('test', 'gpt-4o', 1024);

    expect(mockOpenAIChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ max_tokens: 1024 })
    );
  });

  it('throws when SDK call fails', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Rate limited'));
    await expect(callAI('test', 'claude-sonnet-4-20250514')).rejects.toThrow('Rate limited');
  });
});

// ─── callAIWithFunction ─────────────────────────────────────────────
describe('callAIWithFunction', () => {
  it('uses Claude tool_use for Claude models', async () => {
    const schema = { name: 'extractData', description: 'Extract data', parameters: { type: 'object' } };
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'tool_use', input: { answer: 42 } }],
    });

    const result = await callAIWithFunction('test', 'claude-sonnet-4-20250514', schema);

    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [{ name: 'extractData', description: 'Extract data', input_schema: { type: 'object' } }],
        tool_choice: { type: 'tool', name: 'extractData' },
      })
    );
    expect(result).toEqual({ answer: 42 });
  });

  it('uses OpenAI function_call for GPT models', async () => {
    const schema = { name: 'extractData', description: 'Extract data', parameters: { type: 'object' } };
    mockOpenAIChatCreate.mockResolvedValue({
      choices: [{ message: { function_call: { arguments: '{"answer":42}' } } }],
    });

    const result = await callAIWithFunction('test', 'gpt-4o', schema);

    expect(mockOpenAIChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        functions: [schema],
        function_call: { name: 'extractData' },
      })
    );
    expect(result).toEqual({ answer: 42 });
  });

  it('throws when Claude returns no tool_use block', async () => {
    const schema = { name: 'fn', parameters: {} };
    mockAnthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: 'oops' }] });

    await expect(callAIWithFunction('test', 'claude-sonnet-4-20250514', schema)).rejects.toThrow('No tool use');
  });

  it('throws when OpenAI returns no function_call', async () => {
    const schema = { name: 'fn', parameters: {} };
    mockOpenAIChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'oops' } }],
    });

    await expect(callAIWithFunction('test', 'gpt-4o', schema)).rejects.toThrow('No function call');
  });
});

// ─── generateImage ──────────────────────────────────────────────────
describe('generateImage', () => {
  it('tries Gemini first and returns base64 data URL on success', async () => {
    mockGeminiGenerateContent.mockResolvedValue({
      response: {
        candidates: [{
          content: {
            parts: [
              { text: 'A nice image' },
              { inlineData: { data: 'abc123', mimeType: 'image/png' } },
            ],
          },
        }],
      },
    });

    const result = await generateImage('A cat');

    expect(mockGeminiGenerateContent).toHaveBeenCalled();
    expect(result.url).toBe('data:image/png;base64,abc123');
    expect(result.model).toBe('gemini-3-pro-image-preview');
    expect(result.altText).toBe('A nice image');
  });

  it('falls back to DALL-E when Gemini fails', async () => {
    mockGeminiGenerateContent.mockRejectedValue(new Error('Model not available'));
    mockOpenAIImagesGenerate.mockResolvedValue({
      data: [{ b64_json: 'dalle_base64' }],
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await generateImage('A cat');
    warnSpy.mockRestore();
    logSpy.mockRestore();

    expect(result.url).toBe('data:image/png;base64,dalle_base64');
    expect(result.model).toBe('dall-e-3');
  });

  it('truncates very long prompts', async () => {
    mockGeminiGenerateContent.mockRejectedValue(new Error('fail'));
    mockOpenAIImagesGenerate.mockResolvedValue({
      data: [{ b64_json: 'img' }],
    });

    const longPrompt = 'A'.repeat(5000);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await generateImage(longPrompt);
    warnSpy.mockRestore();
    logSpy.mockRestore();

    const dalleCall = mockOpenAIImagesGenerate.mock.calls[0][0];
    expect(dalleCall.prompt.length).toBeLessThanOrEqual(3504); // 3500 + '...'
  });
});

// ─── generateAltText ────────────────────────────────────────────────
describe('generateAltText', () => {
  it('uses GPT-4o vision to describe the image', async () => {
    mockOpenAIChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'A cat sitting on a mat' } }],
    });

    const result = await generateAltText('data:image/png;base64,abc');

    expect(mockOpenAIChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o' })
    );
    expect(result).toBe('A cat sitting on a mat');
  });

  it('throws when SDK call fails', async () => {
    mockOpenAIChatCreate.mockRejectedValue(new Error('Vision failed'));
    await expect(generateAltText('data:image/png;base64,abc')).rejects.toThrow('Vision failed');
  });
});

// ─── summarizePassageForImage ───────────────────────────────────────
describe('summarizePassageForImage', () => {
  it('returns null for empty passage', async () => {
    const result = await summarizePassageForImage('');
    expect(result).toBeNull();
    expect(mockOpenAIChatCreate).not.toHaveBeenCalled();
  });

  it('returns null for null passage', async () => {
    const result = await summarizePassageForImage(null);
    expect(result).toBeNull();
    expect(mockOpenAIChatCreate).not.toHaveBeenCalled();
  });

  it('returns null for whitespace-only passage', async () => {
    const result = await summarizePassageForImage('   \n  ');
    expect(result).toBeNull();
    expect(mockOpenAIChatCreate).not.toHaveBeenCalled();
  });

  it('calls GPT-3.5-turbo for summarization', async () => {
    mockOpenAIChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'A vivid scene' } }],
    });

    const result = await summarizePassageForImage('Long passage text here');

    expect(mockOpenAIChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-3.5-turbo' })
    );
    expect(result).toBe('A vivid scene');
  });

  it('trims passage before sending', async () => {
    mockOpenAIChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'summary' } }],
    });

    await summarizePassageForImage('  passage with spaces  ');

    const call = mockOpenAIChatCreate.mock.calls[0][0];
    const userMsg = call.messages.find((m) => m.role === 'user');
    expect(userMsg.content).toContain('passage with spaces');
    expect(userMsg.content).not.toMatch(/^\s+passage/);
  });

  it('returns null and warns on SDK error', async () => {
    mockOpenAIChatCreate.mockRejectedValue(new Error('Server error'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await summarizePassageForImage('Some passage');

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('truncates summary if longer than maxChars', async () => {
    mockOpenAIChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'A'.repeat(800) } }],
    });

    const result = await summarizePassageForImage('passage', 700);

    expect(result.length).toBeLessThanOrEqual(700);
  });
});
