import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

process.env.BUCKET = 'chq-visualizer-test';
process.env.TABLE = 'chq-api-test';
// Presigning (@aws-sdk/s3-request-presigner) signs locally and never calls
// s3.send(), so aws-sdk-client-mock cannot intercept it. Static env
// credentials let it resolve offline and instantly, without touching the
// real default provider chain (Lambda supplies real ones the same way).
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key-id';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-access-key';

const { handler } = await import('../src/handlers/vizUpload');

const s3Mock = mockClient(S3Client);
const ddbMock = mockClient(DynamoDBClient);

function eventFor(contentType: string | undefined): APIGatewayProxyEventV2 {
  return {
    headers: {},
    body: contentType === undefined ? null : JSON.stringify({ contentType }),
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

beforeEach(() => {
  s3Mock.reset();
  ddbMock.reset();
  ddbMock.on(PutItemCommand).resolves({});
});

describe('vizUpload handler', () => {
  it('golden: rejects content types other than image/jpeg or image/png', async () => {
    const heic = await handler(eventFor('image/heic'));
    expect(heic.statusCode).toBe(400);

    const gif = await handler(eventFor('image/gif'));
    expect(gif.statusCode).toBe(400);

    const missing = await handler(eventFor(undefined));
    expect(missing.statusCode).toBe(400);
  });

  it('returns an uploadId and putUrl for image/jpeg', async () => {
    const res = await handler(eventFor('image/jpeg'));
    expect(res.statusCode).toBe(200);
    const parsed = JSON.parse(res.body as string);
    expect(typeof parsed.uploadId).toBe('string');
    expect(parsed.uploadId.length).toBeGreaterThan(0);
    expect(typeof parsed.putUrl).toBe('string');
    expect(parsed.putUrl).toContain('chq-visualizer-test');
  });

  it('records upload metadata keyed by uploadId for image/png', async () => {
    const res = await handler(eventFor('image/png'));
    expect(res.statusCode).toBe(200);
    const putCalls = ddbMock.commandCalls(PutItemCommand);
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0]?.args[0].input.Item?.contentType).toEqual({ S: 'image/png' });
    expect(putCalls[0]?.args[0].input.Item?.objectKey?.S).toMatch(/^uploads\/.+\.png$/);
  });
});
