// Forwards mail received at info@comforthomequote.com to the personal
// inboxes in FORWARD_TO. SES receiving stored the raw message in S3; this
// rewrites just enough headers to resend it legitimately:
//   - From becomes info@ (SES only sends as verified identities), with the
//     original sender preserved in the display name and in Reply-To, so
//     replying from Gmail goes to the actual sender.
//   - Return-Path/Sender/DKIM-Signature/Message-ID are dropped; they
//     belonged to the original transport and would fail or conflict here.
// Body (and therefore attachments) pass through byte-identical.
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const s3 = new S3Client({});
const ses = new SESv2Client({});

const BUCKET = process.env.BUCKET;
const KEY_PREFIX = process.env.KEY_PREFIX ?? 'inbound/';
const FROM_ADDRESS = process.env.FROM_ADDRESS;
const FORWARD_TO = (process.env.FORWARD_TO ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const STRIP_HEADERS = new Set([
  'return-path',
  'sender',
  'dkim-signature',
  'message-id',
  'received-spf',
  'authentication-results',
]);

// Splits a raw RFC 5322 header block into logical (folded) header lines.
function logicalHeaderLines(headerBlock) {
  const lines = headerBlock.split('\r\n');
  const logical = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && logical.length > 0) {
      logical[logical.length - 1] += `\r\n${line}`;
    } else if (line.length > 0) {
      logical.push(line);
    }
  }
  return logical;
}

export function rewriteForForward(raw, fromAddress) {
  const text = raw.toString('binary');
  const splitAt = text.indexOf('\r\n\r\n');
  const headerBlock = splitAt === -1 ? text : text.slice(0, splitAt);
  const body = splitAt === -1 ? '' : text.slice(splitAt);

  let originalFrom = '';
  let hasReplyTo = false;
  const kept = [];
  for (const line of logicalHeaderLines(headerBlock)) {
    const name = line.slice(0, line.indexOf(':')).trim().toLowerCase();
    if (name === 'from') {
      originalFrom = line.slice(line.indexOf(':') + 1).trim();
      continue;
    }
    if (name === 'reply-to') hasReplyTo = true;
    if (STRIP_HEADERS.has(name)) continue;
    kept.push(line);
  }

  // Display name: the original sender, flattened to one sanitized line so
  // a hostile From header can never inject additional headers here.
  const display = originalFrom.replace(/[\r\n"]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  kept.push(`From: "${display || 'ComfortHomeQuote inbox'}" <${fromAddress}>`);
  if (!hasReplyTo && originalFrom) {
    kept.push(`Reply-To: ${originalFrom.replace(/[\r\n]+/g, ' ').trim()}`);
  }

  return Buffer.from(kept.join('\r\n') + body, 'binary');
}

export async function handler(event) {
  const messageId = event?.Records?.[0]?.ses?.mail?.messageId;
  if (!messageId || FORWARD_TO.length === 0) return;

  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: `${KEY_PREFIX}${messageId}` }));
  const raw = Buffer.from(await obj.Body.transformToByteArray());
  const rewritten = rewriteForForward(raw, FROM_ADDRESS);

  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: FROM_ADDRESS,
      Destination: { ToAddresses: FORWARD_TO },
      Content: { Raw: { Data: rewritten } },
    }),
  );
  console.log(`forwarded ${messageId} to ${FORWARD_TO.length} recipient(s)`);
}
