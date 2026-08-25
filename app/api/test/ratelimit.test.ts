import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { checkAndIncrement } from '../src/lib/ratelimit';

const ddbMock = mockClient(DynamoDBClient);

beforeEach(() => {
  ddbMock.reset();
});

describe('checkAndIncrement', () => {
  it('golden: denies once the counter passes cap (allows exactly cap, denies cap+1)', async () => {
    const cap = 3;
    let count = 0;
    ddbMock.on(UpdateItemCommand).callsFake(() => {
      count += 1;
      return { Attributes: { count: { N: String(count) } } };
    });

    const results: boolean[] = [];
    for (let i = 0; i < cap + 1; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await checkAndIncrement('chq-api', 'measure#ip#203.0.113.5#2026-08-25', cap));
    }

    expect(results).toEqual([true, true, true, false]);
  });

  it('sets the expiresAt TTL attribute via the update expression', async () => {
    ddbMock.on(UpdateItemCommand).resolves({ Attributes: { count: { N: '1' } } });
    await checkAndIncrement('chq-api', 'measure#ip#203.0.113.5#2026-08-25', 20);
    const call = ddbMock.commandCalls(UpdateItemCommand)[0];
    expect(call?.args[0].input.ExpressionAttributeNames).toMatchObject({ '#ttl': 'expiresAt' });
    expect(call?.args[0].input.TableName).toBe('chq-api');
  });
});
