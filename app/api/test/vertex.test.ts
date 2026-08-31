import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setTokenProviderForTests,
  buildVertexEditPrompt,
  generateRoofImageVertex,
} from '../src/lib/vertex';

// Fixture values only. Never a real credential.
const FAKE_TOKEN = 'fixture-token-abc';
const FAKE_PROJECT = 'fixture-project';

function okResponse(imageData: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text: 'Here is your image.' }, { inlineData: { mimeType: 'image/png', data: imageData } }],
          },
        },
      ],
    }),
  };
}

describe('vertex backend', () => {
  beforeEach(() => {
    __setTokenProviderForTests(async () => ({ token: FAKE_TOKEN, projectId: FAKE_PROJECT }));
  });
  afterEach(() => {
    __setTokenProviderForTests(null);
    vi.unstubAllGlobals();
    delete process.env.VERTEX_MODEL;
    delete process.env.VERTEX_PROJECT;
  });

  it('posts the spike-proven request shape to the global endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('cmVuZGVy'));
    vi.stubGlobal('fetch', fetchMock);

    const out = await generateRoofImageVertex(
      'aW1hZ2U=',
      'image/jpeg',
      'Rustic Black',
      'A bold, dimensional blend of deep black, charcoal, and subtle dark-gray tones. More text.',
      'Black',
    );

    expect(out).toBe('cmVuZGVy');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      `https://aiplatform.googleapis.com/v1/projects/${FAKE_PROJECT}/locations/global/publishers/google/models/gemini-2.5-flash-image:generateContent`,
    );
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.generationConfig.responseModalities).toEqual(['TEXT', 'IMAGE']);
    const parts = body.contents[0].parts;
    expect(parts[0].inlineData).toEqual({ mimeType: 'image/jpeg', data: 'aW1hZ2U=' });
    expect(parts[1].text).toContain('rustic black architectural asphalt shingles');
    expect(parts[1].text).toContain('a bold, dimensional blend of deep black');
    expect(parts[1].text).toContain('drip edge trim along the roof edges to black');
    expect((init as RequestInit).headers).toMatchObject({ authorization: `Bearer ${FAKE_TOKEN}` });
  });

  it('VERTEX_PROJECT overrides the project in the endpoint URL (test SA lives in a different project than Vertex)', async () => {
    process.env.VERTEX_PROJECT = 'vertex-enabled-project';
    // The default provider applies the override; the test seam must mirror it.
    __setTokenProviderForTests(async () => ({
      token: FAKE_TOKEN,
      projectId: process.env.VERTEX_PROJECT || FAKE_PROJECT,
    }));
    const fetchMock = vi.fn().mockResolvedValue(okResponse('eA=='));
    vi.stubGlobal('fetch', fetchMock);
    await generateRoofImageVertex('aW1n', 'image/png', 'Dual Black', 'A rich, classic black.');
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/projects/vertex-enabled-project/locations/global/');
  });

  it('honors VERTEX_MODEL override', async () => {
    process.env.VERTEX_MODEL = 'gemini-3-pro-image-preview';
    const fetchMock = vi.fn().mockResolvedValue(okResponse('eA=='));
    vi.stubGlobal('fetch', fetchMock);
    await generateRoofImageVertex('aW1n', 'image/png', 'Dual Black', 'A rich, classic black.');
    expect(String(fetchMock.mock.calls[0]![0])).toContain('gemini-3-pro-image-preview:generateContent');
  });

  it('throws status-only errors with no token or key material', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'nope' }) }),
    );
    await expect(
      generateRoofImageVertex('aW1n', 'image/png', 'Dual Black', 'A rich, classic black.'),
    ).rejects.toSatisfy((e: Error) => e.message === 'vertex-generation-failed-403' && !e.message.includes(FAKE_TOKEN));
  });

  it('throws when the response carries no image part', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'sorry' }] } }] }),
      }),
    );
    await expect(
      generateRoofImageVertex('aW1n', 'image/png', 'Dual Black', 'A rich, classic black.'),
    ).rejects.toThrow('vertex-generation-failed-noimage');
  });

  it('prompt builder output carries no em dash', () => {
    const prompt = buildVertexEditPrompt('Weathered Wood', 'A natural blend — with dashes. More.', 'Brown');
    expect(prompt).not.toContain('—');
    expect(prompt).not.toContain('--');
  });
});
