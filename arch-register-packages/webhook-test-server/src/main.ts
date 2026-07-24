import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const port = Number(process.env['PORT'] ?? 3020);
const secret = process.env['WEBHOOK_TEST_SECRET'];
const attempts = new Map<string, number>();

const signatureValid = (body: Buffer, signature: string | undefined) => {
  if (!secret) return null;
  if (!signature?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('hex'));
  const actual = Buffer.from(signature.slice('sha256='.length));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"ok":true}');
    return;
  }
  if (request.method !== 'POST' || !request.url?.startsWith('/webhook')) {
    response.writeHead(404).end();
    return;
  }

  const chunks: Buffer[] = [];
  request.on('data', chunk => chunks.push(Buffer.from(chunk)));
  request.on('end', () => {
    const body = Buffer.concat(chunks);
    const count = (attempts.get(request.url!) ?? 0) + 1;
    attempts.set(request.url!, count);
    const failCount = Number(request.url!.match(/^\/webhook\/fail\/(\d+)/)?.[1] ?? 0);
    const status = count <= failCount ? 500 : 204;
    const verification = signatureValid(
      body,
      request.headers['x-arch-register-signature-256'] as string | undefined
    );
    let parsed: unknown = body.toString('utf8');
    try {
      parsed = JSON.parse(body.toString('utf8'));
    } catch {
      // Keep the raw text for non-JSON requests.
    }
    console.log(
      JSON.stringify(
        {
          received_at: new Date().toISOString(),
          attempt: count,
          method: request.method,
          path: request.url,
          response_status: status,
          signature_valid: verification ?? 'not configured',
          headers: request.headers,
          body: parsed
        },
        null,
        2
      )
    );
    response.writeHead(status).end();
  });
});

server.listen(port, () => {
  console.log(`Webhook test server: http://localhost:${port}/webhook`);
  console.log(`Retry test: http://localhost:${port}/webhook/fail/2`);
});
