import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

vi.mock('../../services/supabaseClient', () => ({
  supabase: { auth: { getSession: mockGetSession } },
}));

import {
  callAI,
  callAIWithFunction,
  generateImage,
  generateAltText,
  summarizePassageForImage,
} from '../../services/aiClient';

function mockFetchOnce({ ok = true, status = 200, body = {} } = {}) {
  const fn = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  global.fetch = fn;
  return fn;
}

/** The parsed JSON body of the Nth fetch call. */
const sentBody = (fetchMock, n = 0) => JSON.parse(fetchMock.mock.calls[n][1].body);

beforeEach(() => {
  mockGetSession.mockReset().mockResolvedValue({
    data: { session: { access_token: 'jwt-123' } },
  });
});

afterEach(() => {
  delete global.fetch;
});

// ─── request shape ───────────────────────────────────────────────────
describe('request shape', () => {
  it('POSTs to /api/ai with the session bearer token', async () => {
    const fetchMock = mockFetchOnce({ body: { text: 'hi' } });
    await callAI('Say hi', 'claude-sonnet-4-5');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt-123');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('omits the Authorization header when there is no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = mockFetchOnce({ body: { text: 'hi' } });
    await callAI('Say hi', 'claude-sonnet-4-5');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});

// ─── callAI ──────────────────────────────────────────────────────────
describe('callAI', () => {
  it('sends the generate action and returns text', async () => {
    const fetchMock = mockFetchOnce({ body: { text: 'Hello from Claude!' } });
    const result = await callAI('Say hello', 'claude-sonnet-4-5');

    expect(sentBody(fetchMock)).toEqual({
      action: 'generate',
      prompt: 'Say hello',
      model: 'claude-sonnet-4-5',
      maxTokens: 4096,
    });
    expect(result).toBe('Hello from Claude!');
  });

  it('passes a custom maxTokens', async () => {
    const fetchMock = mockFetchOnce({ body: { text: 'Hi' } });
    await callAI('test', 'claude-haiku-4-5-20251001', 1024);
    expect(sentBody(fetchMock).maxTokens).toBe(1024);
  });

  it('throws with the server error message', async () => {
    mockFetchOnce({ ok: false, status: 502, body: { error: 'Rate limited' } });
    await expect(callAI('test', 'claude-sonnet-4-5')).rejects.toThrow('Rate limited');
  });

  it('throws when the server rejects the model', async () => {
    mockFetchOnce({ ok: false, status: 400, body: { error: 'Model not allowed: gpt-4o' } });
    await expect(callAI('test', 'gpt-4o')).rejects.toThrow('Model not allowed: gpt-4o');
  });

  it('throws on 401', async () => {
    mockFetchOnce({ ok: false, status: 401, body: { error: 'Unauthorized' } });
    await expect(callAI('test', 'claude-sonnet-4-5')).rejects.toThrow('Unauthorized');
  });

  it('throws a status-based message when the body is not JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    });
    await expect(callAI('test', 'claude-sonnet-4-5')).rejects.toThrow('500');
  });
});

// ─── callAIWithFunction ─────────────────────────────────────────────
describe('callAIWithFunction', () => {
  it('sends the function action and unwraps result', async () => {
    const schema = { name: 'extractData', description: 'Extract', parameters: { type: 'object' } };
    const fetchMock = mockFetchOnce({ body: { result: { answer: 42 } } });

    const result = await callAIWithFunction('test', 'claude-sonnet-4-5', schema);

    expect(sentBody(fetchMock)).toEqual({
      action: 'function',
      prompt: 'test',
      model: 'claude-sonnet-4-5',
      functionSchema: schema,
    });
    expect(result).toEqual({ answer: 42 });
  });

  it('propagates a server error', async () => {
    mockFetchOnce({ ok: false, status: 502, body: { error: 'No tool use in Claude response' } });
    await expect(
      callAIWithFunction('test', 'claude-sonnet-4-5', { name: 'fn', parameters: {} }),
    ).rejects.toThrow('No tool use');
  });
});

// ─── generateImage ──────────────────────────────────────────────────
describe('generateImage', () => {
  it('sends the image action and returns the payload unchanged', async () => {
    const fetchMock = mockFetchOnce({
      body: {
        url: 'data:image/png;base64,abc',
        model: 'gemini-3-pro-image-preview',
        altText: 'A nice image',
      },
    });

    const result = await generateImage('A cat');

    expect(sentBody(fetchMock)).toEqual({ action: 'image', prompt: 'A cat' });
    expect(result.url).toBe('data:image/png;base64,abc');
    expect(result.model).toBe('gemini-3-pro-image-preview');
    expect(result.altText).toBe('A nice image');
  });

  it('ignores the legacy size argument', async () => {
    const fetchMock = mockFetchOnce({ body: { url: 'u', model: 'm', altText: '' } });
    await generateImage('A cat', '1024x1024');
    expect(sentBody(fetchMock)).toEqual({ action: 'image', prompt: 'A cat' });
  });

  it('throws when generation fails', async () => {
    mockFetchOnce({ ok: false, status: 502, body: { error: 'Image generation failed: overloaded' } });
    await expect(generateImage('A cat')).rejects.toThrow('Image generation failed');
  });
});

// ─── generateAltText ────────────────────────────────────────────────
describe('generateAltText', () => {
  it('sends the altText action and returns text', async () => {
    const fetchMock = mockFetchOnce({ body: { text: 'A cat sitting on a mat' } });
    const result = await generateAltText('data:image/png;base64,abc');

    expect(sentBody(fetchMock)).toEqual({
      action: 'altText',
      imageDataUrl: 'data:image/png;base64,abc',
    });
    expect(result).toBe('A cat sitting on a mat');
  });

  it('throws when the call fails', async () => {
    mockFetchOnce({ ok: false, status: 502, body: { error: 'Vision failed' } });
    await expect(generateAltText('data:image/png;base64,abc')).rejects.toThrow('Vision failed');
  });
});

// ─── summarizePassageForImage ───────────────────────────────────────
describe('summarizePassageForImage', () => {
  it('returns null for empty, null and whitespace passages without calling the server', async () => {
    const fetchMock = mockFetchOnce({ body: { summary: 'unused' } });
    expect(await summarizePassageForImage('')).toBeNull();
    expect(await summarizePassageForImage(null)).toBeNull();
    expect(await summarizePassageForImage('   \n  ')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the summarize action with a trimmed passage', async () => {
    const fetchMock = mockFetchOnce({ body: { summary: 'A vivid scene' } });
    const result = await summarizePassageForImage('  passage with spaces  ');

    expect(sentBody(fetchMock)).toEqual({
      action: 'summarize',
      passage: 'passage with spaces',
      maxChars: 700,
    });
    expect(result).toBe('A vivid scene');
  });

  it('returns null and warns when the request fails', async () => {
    mockFetchOnce({ ok: false, status: 502, body: { error: 'Server error' } });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await summarizePassageForImage('Some passage');

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns null when the server returns an empty summary', async () => {
    mockFetchOnce({ body: { summary: '' } });
    expect(await summarizePassageForImage('Some passage')).toBeNull();
  });
});
