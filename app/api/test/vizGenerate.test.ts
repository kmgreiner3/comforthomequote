import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

process.env.BUCKET = 'chq-visualizer-test';
process.env.TABLE = 'chq-api-test';
process.env.MODEL_ID = 'amazon.nova-canvas-v1:0';
// See vizUpload.test.ts: presigning signs locally, needs real-shaped but
// fake static credentials so it resolves offline and instantly.
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key-id';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-access-key';

const { handler } = await import('../src/handlers/vizGenerate');

const ddbMock = mockClient(DynamoDBClient);
const s3Mock = mockClient(S3Client);
const bedrockMock = mockClient(BedrockRuntimeClient);

const UPLOAD_ID = 'upload-123';

function eventFor(body: Record<string, unknown> | undefined): APIGatewayProxyEventV2 {
  return {
    headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    body: body === undefined ? null : JSON.stringify(body),
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

function validBody(overrides: Partial<Record<string, unknown>> = {}) {
  return { uploadId: UPLOAD_ID, product: 'tamko-titan-xt', color: 'Rustic Black', ...overrides };
}

beforeEach(() => {
  ddbMock.reset();
  s3Mock.reset();
  bedrockMock.reset();
  // Default: upload exists, both caps have room.
  ddbMock
    .on(GetItemCommand)
    .resolves({ Item: { pk: { S: `upload#${UPLOAD_ID}` }, objectKey: { S: `uploads/${UPLOAD_ID}.jpg` } } });
  ddbMock.on(UpdateItemCommand).resolves({ Attributes: { count: { N: '1' } } });
  // Default: cache miss (tests that care about a hit override this).
  s3Mock.on(HeadObjectCommand).rejects(new Error('NotFound'));
});

describe('vizGenerate handler', () => {
  it('400s on an unknown product', async () => {
    const res = await handler(eventFor(validBody({ product: 'not-a-product' })));
    expect(res.statusCode).toBe(400);
  });

  it('400s on a color not in the chosen product line', async () => {
    const res = await handler(eventFor(validBody({ product: 'iko-cambridge', color: 'Rustic Black' })));
    expect(res.statusCode).toBe(400);
  });

  it('404s on an unknown uploadId', async () => {
    ddbMock.on(GetItemCommand).resolves({});
    const res = await handler(eventFor(validBody()));
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body as string)).toEqual({ error: 'unknown upload' });
  });

  it('429s once a cap is exceeded', async () => {
    ddbMock.on(UpdateItemCommand).resolves({ Attributes: { count: { N: '999' } } });
    const res = await handler(eventFor(validBody()));
    expect(res.statusCode).toBe(429);
  });

  it('golden: a cache hit performs zero bedrock invocations and zero rate-limit increments', async () => {
    s3Mock.on(HeadObjectCommand).resolves({});
    const res = await handler(eventFor(validBody()));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string).url).toBeTruthy();
    expect(bedrockMock.commandCalls(InvokeModelCommand)).toHaveLength(0);
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
    // Cache hits are free: neither the per-IP nor the per-uploadId cap
    // counter should be touched (no DynamoDB UpdateItem at all).
    expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
  });

  it('on a cache miss, loads the upload, invokes Nova Canvas once, and stores the render', async () => {
    s3Mock.on(HeadObjectCommand).rejects(new Error('NotFound'));
    s3Mock.on(GetObjectCommand).resolves({ Body: Buffer.from('fake-source-bytes') as never });
    s3Mock.on(PutObjectCommand).resolves({});
    bedrockMock.on(InvokeModelCommand).resolves({
      body: (new TextEncoder().encode(JSON.stringify({ images: ['rendered-base64'] })) as never),
    });

    const res = await handler(eventFor(validBody()));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string).url).toBeTruthy();
    expect(bedrockMock.commandCalls(InvokeModelCommand)).toHaveLength(1);
    const putCalls = s3Mock.commandCalls(PutObjectCommand);
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0]?.args[0].input.Key).toBe(`renders/${UPLOAD_ID}/tamko-titan-xt/rustic-black.png`);
    expect(putCalls[0]?.args[0].input.ContentType).toBe('image/png');

    const invokeCall = bedrockMock.commandCalls(InvokeModelCommand)[0];
    const sentPrompt = JSON.parse(String(invokeCall?.args[0].input.body)) as {
      inPaintingParams: { text: string };
    };
    expect(sentPrompt.inPaintingParams.text).toContain('Rustic Black');
  });

  it('feedback round 8: 400s on an invalid dripEdge value', async () => {
    const res = await handler(eventFor(validBody({ dripEdge: 'Green' })));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body as string)).toEqual({ error: 'invalid dripEdge' });
  });

  it('accepts a request with no dripEdge at all (optional, unchanged behavior)', async () => {
    s3Mock.on(HeadObjectCommand).resolves({});
    const res = await handler(eventFor(validBody()));
    expect(res.statusCode).toBe(200);
  });

  it('on a cache miss with a valid dripEdge, the prompt sent to Nova Canvas mentions the drip edge trim', async () => {
    s3Mock.on(HeadObjectCommand).rejects(new Error('NotFound'));
    s3Mock.on(GetObjectCommand).resolves({ Body: Buffer.from('fake-source-bytes') as never });
    s3Mock.on(PutObjectCommand).resolves({});
    bedrockMock.on(InvokeModelCommand).resolves({
      body: (new TextEncoder().encode(JSON.stringify({ images: ['rendered-base64'] })) as never),
    });

    const res = await handler(eventFor(validBody({ dripEdge: 'White' })));

    expect(res.statusCode).toBe(200);
    const invokeCall = bedrockMock.commandCalls(InvokeModelCommand)[0];
    const sentPrompt = JSON.parse(String(invokeCall?.args[0].input.body)) as {
      inPaintingParams: { text: string };
    };
    expect(sentPrompt.inPaintingParams.text).toContain('with White drip edge trim');
  });

  it('feedback round 8: the render cache key differs by dripEdge, so a render without one is never served for a request WITH one', async () => {
    s3Mock.on(HeadObjectCommand).rejects(new Error('NotFound'));
    s3Mock.on(GetObjectCommand).resolves({ Body: Buffer.from('fake-source-bytes') as never });
    s3Mock.on(PutObjectCommand).resolves({});
    bedrockMock.on(InvokeModelCommand).resolves({
      body: (new TextEncoder().encode(JSON.stringify({ images: ['rendered-base64'] })) as never),
    });

    await handler(eventFor(validBody()));
    await handler(eventFor(validBody({ dripEdge: 'Black' })));

    const putCalls = s3Mock.commandCalls(PutObjectCommand);
    expect(putCalls).toHaveLength(2);
    const keys = putCalls.map((c) => c.args[0].input.Key);
    expect(keys[0]).toBe(`renders/${UPLOAD_ID}/tamko-titan-xt/rustic-black.png`);
    expect(keys[1]).toBe(`renders/${UPLOAD_ID}/tamko-titan-xt/rustic-black-black.png`);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('502s with generation-failed when Nova Canvas invocation throws', async () => {
    s3Mock.on(HeadObjectCommand).rejects(new Error('NotFound'));
    s3Mock.on(GetObjectCommand).resolves({ Body: Buffer.from('fake-source-bytes') as never });
    bedrockMock.on(InvokeModelCommand).rejects(new Error('model unavailable'));

    const res = await handler(eventFor(validBody()));

    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body as string)).toEqual({ error: 'generation-failed' });
  });
});
