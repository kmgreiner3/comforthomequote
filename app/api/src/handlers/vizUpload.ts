import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { json, parseBody } from '../lib/http';

// Module-scope clients so aws-sdk-client-mock intercepts every call.
const s3 = new S3Client({});
const ddb = new DynamoDBClient({});

const BUCKET = process.env.BUCKET ?? '';
const TABLE = process.env.TABLE ?? '';

const PUT_URL_EXPIRY_SECONDS = 15 * 60;
// Uploads/renders both expire from S3 after 30 days (Global Constraints
// lifecycle rule); this metadata record mirrors that so a stale uploadId
// reads back as "unknown upload" once the underlying object is gone too.
const UPLOAD_METADATA_TTL_SECONDS = 30 * 24 * 60 * 60;

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

interface UploadBody {
  contentType?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const body = parseBody<UploadBody>(event);
  const contentType = body?.contentType;
  const ext = contentType ? ALLOWED_CONTENT_TYPES[contentType] : undefined;
  if (!contentType || !ext) {
    return json(400, { error: 'contentType must be image/jpeg or image/png' });
  }

  const uploadId = randomUUID();
  const key = `uploads/${uploadId}.${ext}`;

  // The presigned URL binds Content-Type into the signature (enforced);
  // plain presigned PUT cannot enforce a max byte range the way a presigned
  // POST policy can, so the 8MB limit is enforced by S3 bucket policy /
  // client-side downscaling (Task 4) rather than here.
  const putUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: PUT_URL_EXPIRY_SECONDS },
  );

  const nowSeconds = Math.floor(Date.now() / 1000);
  await ddb.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        pk: { S: `upload#${uploadId}` },
        objectKey: { S: key },
        contentType: { S: contentType },
        expiresAt: { N: String(nowSeconds + UPLOAD_METADATA_TTL_SECONDS) },
      },
    }),
  );

  return json(200, { uploadId, putUrl });
}
