import { describe, expect, it } from 'vitest';
import { ApiClient, ApiError } from './client';
import { FakeFetch, sessionResponse } from '../test-support';

function clientWith(f: FakeFetch): ApiClient {
  return new ApiClient('https://api.test', f.impl);
}

describe('ApiClient', () => {
  it('creates sessions and returns the server session id', async () => {
    const f = new FakeFetch().setDefault(sessionResponse());
    const api = clientWith(f);
    const { sessionId } = await api.createSession({
      contentId: 'article-1',
      participant: { viewerIdHash: 'abc' },
      metadata: { policyId: 'pol' },
    });
    expect(sessionId).toBe('urn:vap:session:abc123');
    const call = f.calls[0]!;
    expect(call.url).toBe('https://api.test/v1/sessions');
    expect(call.method).toBe('POST');
    expect((call.body as { contentId: string }).contentId).toBe('article-1');
  });

  it('rejects malformed session responses', async () => {
    const f = new FakeFetch().setDefault({ status: 201, body: {} });
    await expect(
      clientWith(f).createSession({ contentId: 'c', participant: { viewerIdHash: 'h' } }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('wraps non-2xx into ApiError with the server message and status', async () => {
    const f = new FakeFetch().setDefault({
      status: 422,
      body: { error: { code: 'EVIDENCE_REJECTED', message: 'bad payload' } },
    });
    const err = await clientWith(f)
      .ingestEvidence({ foo: 1 })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.message).toBe('bad payload');
  });

  it('maps transport failures to ApiError with status 0', async () => {
    const f = new FakeFetch().setDefault({ throwMessage: 'socket hangup' });
    const err = await clientWith(f)
      .heartbeat('urn:vap:session:x')
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
  });

  it('fetchProof resolves undefined instead of throwing', async () => {
    const f = new FakeFetch().setDefault({ status: 404, body: {} });
    await expect(clientWith(f).fetchProof('urn:vap:session:x')).resolves.toBeUndefined();
  });
});
