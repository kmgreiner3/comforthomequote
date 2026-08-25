import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

// Module-scope client so aws-sdk-client-mock's mockClient(DynamoDBClient)
// intercepts every call regardless of which handler imports this module.
const ddb = new DynamoDBClient({});

// Global Constraints: all rate-limit counters use a 2-day TTL on `expiresAt`.
const DEFAULT_TTL_SECONDS = 2 * 24 * 60 * 60;

export function todayStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// Atomically increments the counter item at `pk` and reports whether the
// resulting count is still within `cap`. First write also sets the TTL so
// the item self-expires; later writes leave the existing TTL alone.
export async function checkAndIncrement(
  table: string,
  pk: string,
  cap: number,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<boolean> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const result = await ddb.send(
    new UpdateItemCommand({
      TableName: table,
      Key: { pk: { S: pk } },
      UpdateExpression: 'ADD #count :one SET #ttl = if_not_exists(#ttl, :ttl)',
      ExpressionAttributeNames: { '#count': 'count', '#ttl': 'expiresAt' },
      ExpressionAttributeValues: {
        ':one': { N: '1' },
        ':ttl': { N: String(nowSeconds + ttlSeconds) },
      },
      ReturnValues: 'UPDATED_NEW',
    }),
  );
  const count = Number(result.Attributes?.count?.N ?? '0');
  return count <= cap;
}
