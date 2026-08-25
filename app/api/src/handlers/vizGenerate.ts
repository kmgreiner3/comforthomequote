import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import type { ShingleKey } from '@chq/pricing';
import { SHINGLES } from '@chq/pricing';
import { clientIp, json, parseBody } from '../lib/http';
import { checkAndIncrement, todayStamp } from '../lib/ratelimit';
import { generateRoofImage } from '../lib/bedrock';
import { COLOR_DESCRIPTIONS } from '../lib/colorDescriptions';
import { slugify } from '../lib/slug';

// Module-scope clients so aws-sdk-client-mock intercepts every call.
const s3 = new S3Client({});
const ddb = new DynamoDBClient({});

const BUCKET = process.env.BUCKET ?? '';
const TABLE = process.env.TABLE ?? '';
const MODEL_ID = process.env.MODEL_ID ?? '';

// Global Constraints: generate capped at 60/IP/day and 40/uploadId total.
const GENERATE_CAP_PER_IP_PER_DAY = 60;
const GENERATE_CAP_PER_UPLOAD = 40;

const GET_URL_EXPIRY_SECONDS = 15 * 60;

interface GenerateBody {
  uploadId?: string;
  product?: string;
  color?: string;
}

function isShingleKey(value: string): value is ShingleKey {
  return value in SHINGLES;
}

async function bodyToBase64(body: unknown): Promise<string> {
  if (body && typeof (body as { transformToByteArray?: unknown }).transformToByteArray === 'function') {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes).toString('base64');
  }
  if (Buffer.isBuffer(body)) {
    return body.toString('base64');
  }
  if (body && typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('base64');
  }
  throw new Error('unsupported upload body type');
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const body = parseBody<GenerateBody>(event);
  const uploadId = body?.uploadId;
  const product = body?.product;
  const color = body?.color;

  if (!uploadId || !product || !color) {
    return json(400, { error: 'uploadId, product and color are required' });
  }
  if (!isShingleKey(product) || !SHINGLES[product].colors.includes(color)) {
    return json(400, { error: 'unknown product or color' });
  }

  const uploadItem = await ddb.send(
    new GetItemCommand({ TableName: TABLE, Key: { pk: { S: `upload#${uploadId}` } } }),
  );
  const uploadKey = uploadItem.Item?.objectKey?.S;
  if (!uploadKey) {
    return json(404, { error: 'unknown upload' });
  }

  const ip = clientIp(event);
  const withinIpCap = await checkAndIncrement(
    TABLE,
    `generate#ip#${ip}#${todayStamp()}`,
    GENERATE_CAP_PER_IP_PER_DAY,
  );
  const withinUploadCap = await checkAndIncrement(
    TABLE,
    `generate#upload#${uploadId}`,
    GENERATE_CAP_PER_UPLOAD,
  );
  if (!withinIpCap || !withinUploadCap) {
    return json(429, { error: 'rate limit exceeded' });
  }

  const slug = slugify(color);
  const renderKey = `renders/${uploadId}/${product}/${slug}.png`;

  const cacheHit = await s3
    .send(new HeadObjectCommand({ Bucket: BUCKET, Key: renderKey }))
    .then(() => true)
    .catch(() => false);

  if (!cacheHit) {
    try {
      const uploadObject = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: uploadKey }));
      const imageBase64 = await bodyToBase64(uploadObject.Body);
      const description = COLOR_DESCRIPTIONS[color] ?? '';
      const renderBase64 = await generateRoofImage(MODEL_ID, imageBase64, color, description);
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: renderKey,
          Body: Buffer.from(renderBase64, 'base64'),
          ContentType: 'image/png',
        }),
      );
    } catch {
      return json(502, { error: 'generation-failed' });
    }
  }

  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: renderKey }), {
    expiresIn: GET_URL_EXPIRY_SECONDS,
  });

  return json(200, { url });
}
