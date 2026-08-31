import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

// Vertex module fully mocked here: this file tests backend SELECTION and the
// global cap, not the Vertex request shape (that lives in vertex.test.ts).
vi.mock('../src/lib/vertex', () => ({
  generateRoofImageVertex: vi.fn().mockResolvedValue('dmVydGV4LXJlbmRlcg=='),
}));

process.env.BUCKET = 'chq-visualizer-test';
process.env.TABLE = 'chq-api-test';
process.env.MODEL_ID = 'amazon.nova-canvas-v1:0';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key-id';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-access-key';

const { handler } = await import('../src/handlers/vizGenerate');
const { generateRoofImageVertex } = await import('../src/lib/vertex');

const ddbMock = mockClient(DynamoDBClient);
const s3Mock = mockClient(S3Client);
const bedrockMock = mockClient(BedrockRuntimeClient);

const UPLOAD_ID = 'upload-123';

function eventFor(body: Record<string, unknown>): APIGatewayProxyEventV2 {
  return {
    headers: { 'x-forwarded-for': '203.0.113.5, 64.252.72.10' },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

const GLOBAL_PK_PREFIX = 'generate#global#';

beforeEach(() => {
  ddbMock.reset();
  s3Mock.reset();
  bedrockMock.reset();
  vi.mocked(generateRoofImageVertex).mockClear();
  delete process.env.GEN_BACKEND;
  ddbMock
    .on(GetItemCommand)
    .resolves({ Item: { pk: { S: `upload#${UPLOAD_ID}` }, objectKey: { S: `uploads/${UPLOAD_ID}.jpg` } } });
  ddbMock.on(UpdateItemCommand).resolves({ Attributes: { count: { N: '1' } } });
  s3Mock.on(HeadObjectCommand).rejects(new Error('NotFound'));
  s3Mock.on(GetObjectCommand).resolves({ Body: Buffer.from('upload-bytes') as never });
  s3Mock.on(PutObjectCommand).resolves({});
});

describe('vizGenerate backend selection and global cap', () => {
  it('GEN_BACKEND=vertex routes generation to Vertex with the upload mime, and Bedrock is never invoked', async () => {
    process.env.GEN_BACKEND = 'vertex';
    const res = await handler(eventFor({ uploadId: UPLOAD_ID, product: 'tamko-titan-xt', color: 'Rustic Black', dripEdge: 'Black' }));
    expect(res.statusCode).toBe(200);
    expect(bedrockMock.commandCalls(InvokeModelCommand)).toHaveLength(0);
    expect(generateRoofImageVertex).toHaveBeenCalledTimes(1);
    const call = vi.mocked(generateRoofImageVertex).mock.calls[0]!;
    expect(call[0]).toBe(Buffer.from('upload-bytes').toString('base64'));
    expect(call[1]).toBe('image/jpeg'); // uploads/upload-123.jpg
    expect(call[2]).toBe('Rustic Black');
    expect(call[4]).toBe('Black');
  });

  it('unset GEN_BACKEND keeps Bedrock as the backend', async () => {
    bedrockMock.on(InvokeModelCommand).resolves({
      body: new TextEncoder().encode(JSON.stringify({ images: ['YmVkcm9jaw=='] })),
    } as never);
    const res = await handler(eventFor({ uploadId: UPLOAD_ID, product: 'tamko-titan-xt', color: 'Rustic Black' }));
    expect(res.statusCode).toBe(200);
    expect(generateRoofImageVertex).not.toHaveBeenCalled();
    expect(bedrockMock.commandCalls(InvokeModelCommand)).toHaveLength(1);
  });

  it('the 101st render of the day is refused with daily-limit and consumes no per-IP or per-upload budget', async () => {
    process.env.GEN_BACKEND = 'vertex';
    ddbMock
      .on(UpdateItemCommand)
      .callsFake((input: { Key: { pk: { S: string } } }) => {
        if (input.Key.pk.S.startsWith(GLOBAL_PK_PREFIX)) {
          return { Attributes: { count: { N: '101' } } };
        }
        return { Attributes: { count: { N: '1' } } };
      });
    const res = await handler(eventFor({ uploadId: UPLOAD_ID, product: 'tamko-titan-xt', color: 'Rustic Black' }));
    expect(res.statusCode).toBe(429);
    expect(JSON.parse(res.body as string)).toEqual({ error: 'daily-limit' });
    expect(generateRoofImageVertex).not.toHaveBeenCalled();
    // Global counter checked first and it was over: no other counter touched.
    const updates = ddbMock.commandCalls(UpdateItemCommand).map((c) => c.args[0].input.Key?.pk?.S);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatch(new RegExp(`^${GLOBAL_PK_PREFIX}`));
  });

  it('a cache hit consumes zero global budget', async () => {
    process.env.GEN_BACKEND = 'vertex';
    s3Mock.on(HeadObjectCommand).resolves({});
    const res = await handler(eventFor({ uploadId: UPLOAD_ID, product: 'tamko-titan-xt', color: 'Rustic Black' }));
    expect(res.statusCode).toBe(200);
    expect(ddbMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
    expect(generateRoofImageVertex).not.toHaveBeenCalled();
  });
});
