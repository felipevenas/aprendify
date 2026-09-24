import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOrCreateStreakRow } from './streakRepository.ts';

test('reuses the existing streak without creating another row', async () => {
  const row = { user_id: 'user-1', questions_today: 3 };
  let creates = 0;
  const result = await loadOrCreateStreakRow(
    async () => ({ data: row, error: null }),
    async () => { creates += 1; return { error: null }; },
  );

  assert.equal(result, row);
  assert.equal(creates, 0);
});

test('creates the first streak and reads the result, including a concurrent insert', async () => {
  const row = { user_id: 'user-1', questions_today: 0 };
  let reads = 0;
  let creates = 0;
  const result = await loadOrCreateStreakRow(
    async () => ({ data: ++reads === 1 ? null : row, error: null }),
    async () => { creates += 1; return { error: null }; },
  );

  assert.equal(result, row);
  assert.equal(reads, 2);
  assert.equal(creates, 1);
});

test('does not treat query or insert errors as an absent streak', async () => {
  const queryError = { message: 'permission denied' };
  let creates = 0;
  await assert.rejects(
    loadOrCreateStreakRow(
      async () => ({ data: null, error: queryError }),
      async () => { creates += 1; return { error: null }; },
    ),
    queryError,
  );
  assert.equal(creates, 0);

  const insertError = { message: 'permission denied for insert' };
  await assert.rejects(
    loadOrCreateStreakRow(
      async () => ({ data: null, error: null }),
      async () => ({ error: insertError }),
    ),
    insertError,
  );
});

test('reports when the row remains invisible after an insert', async () => {
  await assert.rejects(
    loadOrCreateStreakRow(
      async () => ({ data: null, error: null }),
      async () => ({ error: null }),
    ),
    /Registro de streak indisponível/,
  );
});
