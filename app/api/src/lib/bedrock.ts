import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// Module-scope client so aws-sdk-client-mock's mockClient(BedrockRuntimeClient)
// intercepts every call regardless of which handler imports this module.
const bedrock = new BedrockRuntimeClient({});

const MASK_PROMPT = 'the roof of the house';
const NEGATIVE_TEXT = 'text, watermark, distorted architecture, altered windows, altered walls, altered sky';

// Feedback round 8, item 17: an optional drip edge color the render prompt
// should mention. Validated by the handler; this module just renders it
// into text when present.
export type DripEdgeColor = 'White' | 'Black' | 'Brown';

export interface NovaCanvasInpaintingRequest {
  taskType: 'INPAINTING';
  inPaintingParams: {
    image: string;
    maskPrompt: string;
    text: string;
    negativeText: string;
  };
  imageGenerationConfig: {
    numberOfImages: number;
    quality: string;
    cfgScale: number;
  };
}

// Task 0 prompt builder, shared by the spike and the generate handler.
// Site rule: no em dashes anywhere, so any stray one in source copy is
// stripped as a safety net rather than trusted to already be clean.
export function buildVisualizePrompt(colorName: string, description: string, dripEdge?: DripEdgeColor): string {
  const firstSentence = (description.split('.')[0] ?? '').trim().toLowerCase();
  let prompt = `architectural asphalt shingle roof in ${colorName}: ${firstSentence}, photorealistic, keep the rest of the house unchanged`;
  if (dripEdge) prompt += `, with ${dripEdge} drip edge trim`;
  return prompt.replace(/--|—/g, ',');
}

// Task 0 authoritative Nova Canvas INPAINTING request shape.
export function buildInPaintingRequest(
  imageBase64: string,
  colorName: string,
  description: string,
  dripEdge?: DripEdgeColor,
): NovaCanvasInpaintingRequest {
  return {
    taskType: 'INPAINTING',
    inPaintingParams: {
      image: imageBase64,
      maskPrompt: MASK_PROMPT,
      text: buildVisualizePrompt(colorName, description, dripEdge),
      negativeText: NEGATIVE_TEXT,
    },
    imageGenerationConfig: {
      numberOfImages: 1,
      quality: 'standard',
      cfgScale: 7,
    },
  };
}

interface NovaCanvasResponseBody {
  images?: string[];
}

// Invokes Nova Canvas and returns the single generated image as base64 PNG.
// Throws on any failure; callers turn that into a 502 generation-failed.
export async function generateRoofImage(
  modelId: string,
  imageBase64: string,
  colorName: string,
  description: string,
  dripEdge?: DripEdgeColor,
): Promise<string> {
  const request = buildInPaintingRequest(imageBase64, colorName, description, dripEdge);
  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(request),
    }),
  );
  const raw = Buffer.from(response.body ?? new Uint8Array()).toString('utf8');
  const parsed = JSON.parse(raw) as NovaCanvasResponseBody;
  const image = parsed.images?.[0];
  if (!image) throw new Error('Nova Canvas response had no image');
  return image;
}
