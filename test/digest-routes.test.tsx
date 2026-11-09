import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const NORMAL = '2026-10-27';
const EMPTY = '2026-10-28';
const BAD = '2026-10-29';
const MISSING = '2026-01-01';

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify(error === undefined ? { at, job, status, owner } : { at, job, status, owner, error });

let runsDir = '';

const config = () => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

// Job names in the order the page lists them: the first cell of each body row.
function pageJobs(html: string): string[] {
  return [...html.matchAll(/<tr(?: class="[^"]*")?><td>(?:⚠ )?([^<]*)<\/td>/g)].map((m) => m[1] ?? '');
}

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  // File order is not sorted order, so the tests can see the page and JSON sort by job.
  writeFileSync(
    join(runsDir, `${NORMAL}.jsonl`),
    [
      line('2026-10-27T23:00:01+01:00', 'zeta/export', 'ok', 'lane-07'),
      line('2026-10-27T23:00:02+01:00', 'alpha/sync', 'retry', 'lane-07', 'timeout'),
      line('2026-10-27T23:00:03+01:00', 'mid/render', 'ok', null),
      line('2026-10-27T23:10:02+01:00', 'alpha/sync', 'retry', 'lane-07', 'timeout'),
      line('2026-10-27T23:20:02+01:00', 'alpha/sync', 'retry', 'lane-07', 'timeout'),
      line('2026-10-27T23:30:02+01:00', 'alpha/sync', 'ok', 'lane-07'),
      line('2026-10-27T23:40:03+01:00', 'mid/render', 'fail', null, 'quota exceeded'),
    ].join('\n') + '\n',
  );
  writeFileSync(join(runsDir, `${EMPTY}.jsonl`), '');
  writeFileSync(
    join(runsDir, `${BAD}.jsonl`),
    [
      line('2026-10-29T23:00:01+01:00', 'zeta/export', 'ok', 'lane-07'),
      '{"at":"2026-10-29T23:0',
      line('2026-10-29T23:00:03+01:00', 'alpha/sync', 'ok', 'lane-07'),
    ].join('\n') + '\n',
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('returns 200 and the rows for a normal night', async () => {
    const res = await createApp(config()).request(`/digest/${NORMAL}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain(`digest · ${NORMAL}`);
    expect(pageJobs(html)).toEqual(['alpha/sync', 'mid/render', 'zeta/export']);
  });

  it('marks a job with 3 or more retries and a failed job', async () => {
    const html = await (await createApp(config()).request(`/digest/${NORMAL}`)).text();
    expect(html).toContain('⚠ alpha/sync');
    expect(html).toContain('⚠ mid/render');
    expect(html).not.toContain('⚠ zeta/export');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await createApp(config()).request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain(`no run log for ${MISSING}`);
  });

  it('renders an empty night as "nothing ran"', async () => {
    const res = await createApp(config()).request(`/digest/${EMPTY}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(pageJobs(html)).toEqual([]);
  });

  it('still renders the rows of a night with a bad line', async () => {
    const res = await createApp(config()).request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line could not be read');
    expect(pageJobs(html)).toEqual(['alpha/sync', 'zeta/export']);
  });
});

describe('GET /api/digest/:night', () => {
  it('returns 200 and the rows for a normal night', async () => {
    const res = await createApp(config()).request(`/api/digest/${NORMAL}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe(NORMAL);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/sync', 'mid/render', 'zeta/export']);
    expect(body.rows[0]).toMatchObject({ job: 'alpha/sync', runs: 4, retries: 3, lastStatus: 'ok' });
    expect(body.rows[1]).toMatchObject({ job: 'mid/render', owner: null, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(body.badLines).toBe(0);
  });

  it('returns 404 for a night with no file', async () => {
    const res = await createApp(config()).request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: MISSING });
  });

  it('returns no rows for an empty night', async () => {
    const res = await createApp(config()).request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      night: EMPTY,
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts the bad line and still returns the rows', async () => {
    const res = await createApp(config()).request(`/api/digest/${BAD}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/sync', 'zeta/export']);
  });
});

describe('page and JSON agree', () => {
  it.each([NORMAL, EMPTY, BAD])('list the same jobs in the same order for %s', async (night) => {
    const app = createApp(config());
    const html = await (await app.request(`/digest/${night}`)).text();
    const body = (await (await app.request(`/api/digest/${night}`)).json()) as Night;
    expect(pageJobs(html)).toEqual(body.rows.map((r) => r.job));
  });
});
