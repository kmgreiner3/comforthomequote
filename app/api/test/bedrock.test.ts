import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { buildInPaintingRequest, buildVisualizePrompt, generateRoofImage } from '../src/lib/bedrock';

const bedrockMock = mockClient(BedrockRuntimeClient);

beforeEach(() => {
  bedrockMock.reset();
});

describe('buildVisualizePrompt', () => {
  it('golden: contains the color name and no em dash', () => {
    const prompt = buildVisualizePrompt(
      'Rustic Black',
      'A bold—dimensional blend of deep black, charcoal, and subtle dark-gray tones. Second sentence unused.',
    );
    expect(prompt).toContain('Rustic Black');
    expect(prompt).not.toContain('—');
    expect(prompt).not.toContain('--');
  });

  it('uses only the lowercased first sentence of the description', () => {
    const prompt = buildVisualizePrompt('Desert Sand', 'A Warm blend of sand tones. Second sentence should not appear.');
    expect(prompt).toContain('a warm blend of sand tones');
    expect(prompt).not.toContain('Second sentence');
    expect(prompt.startsWith('architectural asphalt shingle roof in Desert Sand:')).toBe(true);
    expect(prompt).toContain('photorealistic, keep the rest of the house unchanged');
  });
});

describe('buildInPaintingRequest', () => {
  it('matches the Task 0 authoritative Nova Canvas INPAINTING request shape', () => {
    const request = buildInPaintingRequest('base64img', 'Rustic Black', 'A bold blend of black tones.');
    expect(request).toEqual({
      taskType: 'INPAINTING',
      inPaintingParams: {
        image: 'base64img',
        maskPrompt: 'the roof of the house',
        text: expect.stringContaining('Rustic Black'),
        negativeText: 'text, watermark, distorted architecture, altered windows, altered walls, altered sky',
      },
      imageGenerationConfig: { numberOfImages: 1, quality: 'standard', cfgScale: 7 },
    });
  });
});

describe('generateRoofImage', () => {
  it('returns the base64 image from the Nova Canvas response body', async () => {
    bedrockMock.on(InvokeModelCommand).resolves({
      body: (new TextEncoder().encode(JSON.stringify({ images: ['render-base64'] })) as never),
    });
    const image = await generateRoofImage(
      'amazon.nova-canvas-v1:0',
      'source-base64',
      'Rustic Black',
      'A bold blend of black tones.',
    );
    expect(image).toBe('render-base64');
  });

  it('throws when Nova Canvas returns no image', async () => {
    bedrockMock
      .on(InvokeModelCommand)
      .resolves({ body: (new TextEncoder().encode(JSON.stringify({ images: [] })) as never) });
    await expect(
      generateRoofImage('amazon.nova-canvas-v1:0', 'source-base64', 'Rustic Black', 'A bold blend.'),
    ).rejects.toThrow();
  });
});
