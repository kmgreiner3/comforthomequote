import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { JWT } from 'google-auth-library';
import type { DripEdgeColor } from './bedrock';

// Vertex AI image-editing backend (gemini-2.5-flash-image), spike-proven
// 2026-08-31. The service account key lives ONLY in the SSM parameter named
// by VERTEX_KEY_PARAM. The GCP project defaults to the key's own project_id
// so a credential migration is a parameter swap; VERTEX_PROJECT overrides it
// when the SA's home project is not the one with Vertex enabled (the test
// SA lives in one project but calls Vertex on another). No field of the key
// or any access token may ever appear in logs or errors.

const ssm = new SSMClient({});

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  project_id: string;
}

let cachedKey: ServiceAccountKey | null = null;
let jwtClient: JWT | null = null;

async function loadKey(): Promise<ServiceAccountKey> {
  if (cachedKey) return cachedKey;
  const paramName = process.env.VERTEX_KEY_PARAM ?? '';
  if (!paramName) throw new Error('vertex-not-configured');
  const res = await ssm.send(new GetParameterCommand({ Name: paramName, WithDecryption: true }));
  const raw = res.Parameter?.Value ?? '';
  if (!raw || raw === 'unset') throw new Error('vertex-not-configured');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('vertex-not-configured');
  }
  const key = parsed as Partial<ServiceAccountKey>;
  if (!key.client_email || !key.private_key || !key.project_id) {
    throw new Error('vertex-not-configured');
  }
  cachedKey = key as ServiceAccountKey;
  return cachedKey;
}

export interface VertexToken {
  token: string;
  projectId: string;
}

type TokenProvider = () => Promise<VertexToken>;

const defaultTokenProvider: TokenProvider = async () => {
  const key = await loadKey();
  if (!jwtClient) {
    jwtClient = new JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }
  const { token } = await jwtClient.getAccessToken();
  if (!token) throw new Error('vertex-auth-failed');
  return { token, projectId: process.env.VERTEX_PROJECT || key.project_id };
};

let tokenProvider: TokenProvider = defaultTokenProvider;

// Test seam: lets tests supply a fake token without real JWT signing.
export function __setTokenProviderForTests(provider: TokenProvider | null): void {
  tokenProvider = provider ?? defaultTokenProvider;
  cachedKey = null;
  jwtClient = null;
}

// Spike-proven prompt (2026-08-31): prompt-only editing, no mask. The em
// dash strip is a safety net for source copy, same as the bedrock builder.
export function buildVertexEditPrompt(
  colorName: string,
  description: string,
  dripEdge?: DripEdgeColor,
): string {
  const firstSentence = (description.split('.')[0] ?? '').trim().toLowerCase();
  // The texture sentence is load-bearing: without it, light colors (Desert
  // Sand, Glacier White) come back as a smooth flat-painted roof with no
  // shingle pattern at all (client report 2026-08-31).
  let prompt =
    `Edit this photo: replace the roof shingles with ${colorName.toLowerCase()} architectural asphalt shingles, ` +
    `${firstSentence}. The new roof must show clearly visible individual architectural shingle tabs with ` +
    `staggered edges, dimensional layering, and granular asphalt texture on every roof plane, never a smooth ` +
    `or flat painted surface. Keep the house structure, walls, windows, landscaping, lighting, and sky ` +
    `exactly the same. Photorealistic.`;
  if (dripEdge) {
    prompt += ` Also change the drip edge trim along the roof edges to ${dripEdge.toLowerCase()}.`;
  }
  return prompt.replace(/--|—/g, ',');
}

interface GenerateContentPart {
  inlineData?: { mimeType?: string; data?: string };
}

// Returns the rendered image as base64 PNG-or-similar bytes.
export async function generateRoofImageVertex(
  imageBase64: string,
  mimeType: string,
  colorName: string,
  description: string,
  dripEdge?: DripEdgeColor,
): Promise<string> {
  const { token, projectId } = await tokenProvider();
  const model = process.env.VERTEX_MODEL ?? 'gemini-2.5-flash-image';
  const url =
    `https://aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/global/publishers/google/models/${model}:generateContent`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: buildVertexEditPrompt(colorName, description, dripEdge) },
        ],
      },
    ],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Status code only: response bodies from an auth failure could echo
    // request details and must never reach logs.
    throw new Error(`vertex-generation-failed-${res.status}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: GenerateContentPart[] } }>;
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const image = parts.find((p) => p.inlineData?.data);
  if (!image?.inlineData?.data) throw new Error('vertex-generation-failed-noimage');
  return image.inlineData.data;
}
