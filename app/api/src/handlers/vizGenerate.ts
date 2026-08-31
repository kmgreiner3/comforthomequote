import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import type { ShingleKey } from '@chq/pricing';
import { SHINGLES } from '@chq/pricing';
import { clientIp, json, parseBody } from '../lib/http';
import { checkAndIncrement, todayStamp } from '../lib/ratelimit';
import { generateRoofImage, type DripEdgeColor } from '../lib/bedrock';
import { generateRoofImageVertex } from '../lib/vertex';
import { COLOR_DESCRIPTIONS } from '../lib/colorDescriptions';
import { slugify } from '../lib/slug';

const DRIP_EDGE_COLORS: readonly DripEdgeColor[] = ['White', 'Black', 'Brown'];

function isDripEdgeColor(value: unknown): value is DripEdgeColor {
  return typeof value === 'string' && (DRIP_EDGE_COLORS as readonly string[]).includes(value);
}

// Module-scope clients so aws-sdk-client-mock intercepts every call.
const s3 = new S3Client({});
const ddb = new DynamoDBClient({});

const BUCKET = process.env.BUCKET ?? '';
const TABLE = process.env.TABLE ?? '';
const MODEL_ID = process.env.MODEL_ID ?? '';

// Global Constraints: generate capped at 60/IP/day and 40/uploadId total,
// plus a global daily ceiling that bounds worst-case spend no matter how
// many IPs an abuser rotates through (the API carries no preview gate).
const GENERATE_CAP_PER_IP_PER_DAY = 60;
const GENERATE_CAP_PER_UPLOAD = 40;
const GENERATE_CAP_GLOBAL_PER_DAY = 100;

const GET_URL_EXPIRY_SECONDS = 15 * 60;

interface GenerateBody {
  uploadId?: string;
  product?: string;
  color?: string;
  // Feedback round 8, item 17: optional -- appends a drip edge trim mention
  // to the render prompt when present. Omitted entirely is fine (existing
  // callers keep working); any value other than the three real colors 400s.
  dripEdge?: string;
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
  const dripEdge = body?.dripEdge;

  if (!uploadId || !product || !color) {
    return json(400, { error: 'uploadId, product and color are required' });
  }
  if (!isShingleKey(product) || !SHINGLES[product].colors.includes(color)) {
    return json(400, { error: 'unknown product or color' });
  }
  if (dripEdge !== undefined && !isDripEdgeColor(dripEdge)) {
    return json(400, { error: 'invalid dripEdge' });
  }

  const uploadItem = await ddb.send(
    new GetItemCommand({ TableName: TABLE, Key: { pk: { S: `upload#${uploadId}` } } }),
  );
  const uploadKey = uploadItem.Item?.objectKey?.S;
  if (!uploadKey) {
    return json(404, { error: 'unknown upload' });
  }

  const slug = slugify(color);
  // The drip edge trim changes what actually gets rendered, so it has to
  // be part of the cache key too -- otherwise a render cached without a
  // drip edge mention would wrongly satisfy a later request that asked
  // for one (or vice versa).
  const dripEdgeSuffix = dripEdge ? `-${slugify(dripEdge)}` : '';
  // Version bumps whenever the prompt changes so stale-prompt renders are
  // never served: v2 = Bedrock -> Vertex switch, v3 = shingle-texture
  // sentence added to the prompt (flat-roof fix, 2026-08-31).
  const renderKey = `renders/v3/${uploadId}/${product}/${slug}${dripEdgeSuffix}.png`;

  // Cache check happens before any rate-limit counters are touched: a
  // cache hit is free (no Bedrock call), so it must not consume either cap.
  const cacheHit = await s3
    .send(new HeadObjectCommand({ Bucket: BUCKET, Key: renderKey }))
    .then(() => true)
    .catch(() => false);

  if (!cacheHit) {
    // Global ceiling first: it is the backstop that holds even when
    // per-IP keys are diluted by IP rotation. Cache hits never get here.
    const withinGlobalCap = await checkAndIncrement(
      TABLE,
      `generate#global#${todayStamp()}`,
      GENERATE_CAP_GLOBAL_PER_DAY,
    );
    if (!withinGlobalCap) {
      return json(429, { error: 'daily-limit' });
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

    try {
      const uploadObject = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: uploadKey }));
      const imageBase64 = await bodyToBase64(uploadObject.Body);
      const description = COLOR_DESCRIPTIONS[color] ?? '';
      const backend = process.env.GEN_BACKEND ?? 'bedrock';
      const uploadMime = uploadKey.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const renderBase64 =
        backend === 'vertex'
          ? await generateRoofImageVertex(
              imageBase64,
              uploadMime,
              color,
              description,
              dripEdge as DripEdgeColor | undefined,
            )
          : await generateRoofImage(
              MODEL_ID,
              imageBase64,
              color,
              description,
              dripEdge as DripEdgeColor | undefined,
            );
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: renderKey,
          Body: Buffer.from(renderBase64, 'base64'),
          ContentType: 'image/png',
        }),
      );
    } catch (err) {
      // Operability: the thrown messages are status-only strings by
      // construction (see vertex.ts / bedrock.ts) -- safe to log, and
      // without this a failing backend is invisible in CloudWatch.
      console.error('generation-failed:', err instanceof Error ? err.message : 'unknown');
      return json(502, { error: 'generation-failed' });
    }
  }

  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: renderKey }), {
    expiresIn: GET_URL_EXPIRY_SECONDS,
  });

  return json(200, { url });
}
