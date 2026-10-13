export interface DailyEntry {
  date: string; labourId?: string; workerName: string; toyId: string; processId: string;
  toyName: string; processName: string; typeName?: string; categoryName?: string;
  minutes: number; pieces: number; isTraining?: boolean; workType?: string;
}
export function dailyRecords(entries: DailyEntry[]) {
  const groups = new Map<string, DailyEntry>();
  for (const entry of entries) {
    if (entry.isTraining || entry.workType === 'training') continue;
    const key = `${entry.date}|${entry.labourId || entry.workerName}|${entry.toyId}|${entry.processId}`;
    const previous = groups.get(key);
    groups.set(key, previous ? { ...previous, minutes: previous.minutes + entry.minutes, pieces: previous.pieces + entry.pieces } : { ...entry });
  }
  const board = new Map<string, DailyEntry & { categoryName: string; hours: number; attempts: number }>();
  const competitors = new Map<string, Map<string, DailyEntry>>();
  const broken: (DailyEntry & { categoryName: string; hours: number; previousPieces: number; previousWorkerName: string; previousDate: string; competitorName?: string; competitorPieces?: number; competitorDate?: string; improvement: number })[] = [];
  for (const entry of [...groups.values()].sort((a, b) => a.date.localeCompare(b.date) || (a.labourId || a.workerName).localeCompare(b.labourId || b.workerName))) {
    if (entry.minutes <= 0 || entry.pieces <= 0) continue;
    const key = `${entry.toyId}|${entry.processId}`, previous = board.get(key);
    const workerId = entry.labourId || entry.workerName;
    const jobWorkers = competitors.get(key) || new Map<string, DailyEntry>();
    const competitor = [...jobWorkers.entries()].filter(([id]) => id !== workerId).map(([, row]) => row).sort((a, b) => b.pieces - a.pieces || a.date.localeCompare(b.date))[0];
    const row = { ...entry, categoryName: entry.categoryName || entry.typeName || 'Archived category', hours: entry.minutes / 60, attempts: (previous?.attempts || 0) + 1 };
    if (!previous || row.pieces > previous.pieces) {
      board.set(key, row);
      if (previous) broken.push({ ...row, previousPieces: previous.pieces, previousWorkerName: previous.workerName, previousDate: previous.date, competitorName: competitor?.workerName, competitorPieces: competitor?.pieces, competitorDate: competitor?.date, improvement: Math.round((row.pieces / previous.pieces - 1) * 100) });
    } else board.set(key, { ...previous, attempts: row.attempts });
    const personalBest = jobWorkers.get(workerId);
    if (!personalBest || entry.pieces > personalBest.pieces) jobWorkers.set(workerId, entry);
    competitors.set(key, jobWorkers);
  }
  return { board: [...board.values()].sort((a, b) => b.pieces - a.pieces || a.toyId.localeCompare(b.toyId) || a.processId.localeCompare(b.processId)), broken };
}
