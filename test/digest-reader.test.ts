import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  const row = (job: string) => night?.rows.find((r) => r.job === job);

  it('reads 5 jobs, sorted by job, and counts the truncated line as bad', () => {
    expect(night).not.toBeNull();
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
    expect(night?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('keeps a job with a null owner', () => {
    expect(row('digest/render')?.owner).toBeNull();
  });

  it('counts runs and retries, and takes the last status from the last line', () => {
    expect(row('fixtures/refresh')).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null });
  });

  it('keeps the last error of a failed job', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', owner: 'lane-07' });
  });

  it('keeps the offset of the first and last time', () => {
    expect(row('lane/sync')).toMatchObject({
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });
});

describe('readNight on a temp runs dir', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for a night with no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    writeFileSync(join(dir, 'latest.jsonl'), '');
    expect(readNight(dir, 'latest')).toBeNull();
    expect(readNight(dir, '../2026-10-28')).toBeNull();
  });

  it('reads an empty file, or only blank lines, as no rows', () => {
    writeFileSync(join(dir, '2026-01-01.jsonl'), '\n  \r\n\n');
    expect(readNight(dir, '2026-01-01')).toEqual({
      night: '2026-01-01',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts bad lines and keeps the good ones', () => {
    const lines = [
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
      'not json',
      '{"at":"2026-01-01T02:00:00+01:00","job":"a","status":"done","owner":"x"}',
      '{"at":"2026-01-01T03:00:00+01:00","job":"a","status":"ok","owner":7}',
      '{"job":"a","status":"ok","owner":"x"}',
      '[1,2]',
      '{"at":"2026-01-01T04:00:00+01:00","job":"a","status":"fail","owner":"y","error":"boom"}',
    ];
    writeFileSync(join(dir, '2026-01-01.jsonl'), lines.join('\n') + '\n');
    const night = readNight(dir, '2026-01-01');
    expect(night?.badLines).toBe(5);
    expect(night?.counts).toEqual({ ok: 1, retry: 0, fail: 1 });
    expect(night?.rows).toEqual([
      {
        job: 'a',
        owner: 'y',
        runs: 2,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'boom',
        firstAt: '2026-01-01T01:00:00+01:00',
        lastAt: '2026-01-01T04:00:00+01:00',
      },
    ]);
  });
});
