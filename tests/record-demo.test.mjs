import test from 'node:test';
import assert from 'node:assert/strict';
import { recordDemo } from '../src/record-demo.ts';
import { dailyRecords } from '../src/daily-records.ts';

test('ten-worker preview creates ten current improvements and replaces 500 with 600', () => {
  const demo = recordDemo('2026-10-12');
  assert.equal(demo.entries.length, 30);
  assert.equal(new Set(demo.entries.map(row => row.labourId)).size, 10);
  const records = dailyRecords(demo.entries);
  assert.equal(records.board.length, 10);
  const current = records.broken.filter(row => records.board.some(best => best.toyId === row.toyId && best.date === row.date && best.pieces === row.pieces));
  assert.equal(current.length, 10);
  const hen = records.board.find(row => row.toyName === 'Hen');
  assert.equal(hen.pieces, 600);
  assert.equal(hen.date, '2026-10-12');
  assert.equal(demo.targets.get(hen.processId) * hen.hours, 300);
  assert.equal(current.find(row => row.toyName === 'Hen').previousPieces, 500);
});
