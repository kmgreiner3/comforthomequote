import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { GetParameterCommand, ParameterNotFound, SSMClient } from '@aws-sdk/client-ssm';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { resetGoogleApiKeyCache } from '../src/lib/google';

process.env.TABLE = 'chq-api-test';
process.env.GOOGLE_KEY_PARAM = '/chq/google-api-key-test';

const { handler } = await import('../src/handlers/addressSuggest');

const ddbMock = mockClient(DynamoDBClient);
const ssmMock = mockClient(SSMClient);

function eventForBody(body: Record<string, unknown> | undefined, ip = '203.0.113.5'): APIGatewayProxyEventV2 {
  return {
    headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: body === undefined ? null : JSON.stringify(body),
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

function placesResponse(descriptions: Array<{ text: string; placeId: string }>) {
  return {
    ok: true,
    json: async () => ({
      suggestions: descriptions.map((d) => ({
        placePrediction: { placeId: d.placeId, text: { text: d.text } },
      })),
    }),
  };
}

beforeEach(() => {
  ddbMock.reset();
  ssmMock.reset();
  resetGoogleApiKeyCache();
  vi.unstubAllGlobals();
  ddbMock.on(UpdateItemCommand).resolves({ Attributes: { count: { N: '1' } } });
});

describe('address-suggest handler', () => {
  it('400s when input is missing', async () => {
    const res = await handler(eventForBody(undefined));
    expect(res.statusCode).toBe(400);
  });

  it('golden: unset key returns available:false with zero rate-limit increments', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'unset' } });
    const res = await handler(eventForBody({ input: '1530 Main St Sar' }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string)).toEqual({ available: false });
    expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
  });

  it('also returns available:false with zero rate-limit increments when the parameter is missing entirely', async () => {
    ssmMock.on(GetParameterCommand).rejects(new ParameterNotFound({ message: 'not found', $metadata: {} }));
    const res = await handler(eventForBody({ input: '1530 Main St Sar' }));
    expect(JSON.parse(res.body as string)).toEqual({ available: false });
    expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
  });

  it('available:false when Places responds non-200, e.g. 403 API-not-enabled (client degrades silently)', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'real-key' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const res = await handler(eventForBody({ input: '1530 Main St Sar' }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string)).toEqual({ available: false });
  });

  it('returns up to 5 {description, placeId} suggestions, out-of-state included (bias, not restriction)', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'real-key' } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        placesResponse([
          { text: '1530 Main St, Sarasota, FL, USA', placeId: 'place-fl-1' },
          { text: '1530 Main St, Atlanta, GA, USA', placeId: 'place-ga-1' },
        ]),
      ),
    );
    const res = await handler(eventForBody({ input: '1530 Main St Sar', sessionToken: 'tok-1' }));
    expect(JSON.parse(res.body as string)).toEqual({
      suggestions: [
        { description: '1530 Main St, Sarasota, FL, USA', placeId: 'place-fl-1' },
        { description: '1530 Main St, Atlanta, GA, USA', placeId: 'place-ga-1' },
      ],
    });
  });

  it('429s once the per-IP daily cap is exceeded', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'real-key' } });
    ddbMock.on(UpdateItemCommand).resolves({ Attributes: { count: { N: '101' } } });
    const res = await handler(eventForBody({ input: '1530 Main St Sar' }));
    expect(res.statusCode).toBe(429);
  });

  it('never leaks the Google API key into the response body', async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: 'super-secret-google-key' } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(placesResponse([{ text: '1530 Main St, Sarasota, FL, USA', placeId: 'place-fl-1' }])),
    );
    const res = await handler(eventForBody({ input: '1530 Main St Sar' }));
    expect(res.body as string).not.toContain('super-secret-google-key');
  });
});
