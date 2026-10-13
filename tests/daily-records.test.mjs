import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyRecords } from '../src/daily-records.ts';
const entry = (date, pieces, extra = {}) => ({ date, labourId: 'a', workerName: 'Worker A', toyId: 'hen', processId: 'body', toyName: 'Hen', processName: 'Body assembly', typeName: 'Jumping Toys', minutes: 480, pieces, ...extra });
test('legacy report history produces the same daily records with no old 500 winner', () => {
  const result = dailyRecords([
    entry('2026-10-01', 500, { minutes: 240 }),
    entry('2026-10-02', 250), entry('2026-10-02', 350),
    entry('2026-10-03', 590, { labourId: 'b', workerName: 'Worker B', minutes: 60 }),
    entry('2026-10-04', 900, { workType: 'training' }),
    entry('2026-10-05', 700, { toyId: 'duck', toyName: 'Duck' })
  ]);
  assert.equal(result.board.length, 2);
  const hen = result.board.find(row => row.toyId === 'hen');
  assert.equal(hen.pieces, 600); assert.equal(hen.workerName, 'Worker A');
  assert.equal(hen.categoryName, 'Jumping Toys'); assert.equal(hen.attempts, 3);
  assert.equal(result.broken[0].previousPieces, 500);
  assert.equal(result.broken[0].pieces, 600);
});


test('a personal record improvement compares against another worker on the same job', () => {
  const result = dailyRecords([
    entry('2026-10-01', 400, {labourId:'b',workerName:'Worker B'}),
    entry('2026-10-02', 500),
    entry('2026-10-03', 900, {labourId:'c',workerName:'Worker C',processId:'head'}),
    entry('2026-10-04', 950, {labourId:'d',workerName:'Worker D',workType:'training'}),
    entry('2026-10-05', 600),
    entry('2026-10-06', 590, {labourId:'e',workerName:'Future Worker'})
  ]);
  const current=result.broken.find(row=>row.date==='2026-10-05');
  assert.equal(current.workerName,'Worker A');
  assert.equal(current.competitorName,'Worker B');
  assert.equal(current.competitorPieces,400);
  assert.equal(current.competitorDate,'2026-10-01');
  const alone=dailyRecords([entry('2026-10-01',500),entry('2026-10-02',600)]).broken[0];
  assert.equal(alone.competitorName,undefined);
  assert.equal(alone.previousPieces,500);
});
