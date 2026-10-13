import type { DailyEntry } from './daily-records';

// Preview fixtures only. Never submit these rows to the production API.
export function recordDemo(endingDate: string) {
  const names = ['Demo Ajay', 'Demo Anil', 'Demo Ankan', 'Demo Badrinath', 'Demo Bhoomika', 'Demo Binodini', 'Demo Bolo', 'Demo Sindhuja', 'Demo Chithra', 'Demo Deepak'];
  const jobs = [
    ['Jumping Toys', 'Hen', 'Body assembly'], ['Jumping Toys', 'Duck', 'Head joint'],
    ['Jumping Toys', 'Dinosaur', 'Leg gumming'], ['Windup / Key Toys', 'Fish', 'Body assembly'],
    ['Windup / Key Toys', 'Lizard', 'Body assembly'], ['Windup / Key Toys', 'Bird', 'Gear box wheel joint'],
    ['Friction Toys', 'Fighter Jet', 'Body assembly'], ['Pullback car', '2196 Car', 'Group body assembly'],
    ['Packing', 'BOPP packing', 'Bird'], ['Stickering', 'Box Stickering', 'C-1 Pullback car']
  ];
  const date = (offset: number) => new Date(new Date(`${endingDate}T00:00:00Z`).getTime() + offset * 86400000).toISOString().slice(0, 10);
  const entries: DailyEntry[] = [];
  const targets = new Map<string, number>();
  jobs.forEach(([categoryName, toyName, processName], index) => {
    const processId = `demo-process-${index}`, toyId = `demo-toy-${index}`;
    targets.set(processId, (300 + index * 40) / 8);
    [300 + index * 40, 500 + index * 45, 600 + index * 50].forEach((pieces, attempt) => {
      const worker = attempt === 0 ? (index + 1) % names.length : index;
      entries.push({ date: date(attempt - 2), labourId: `demo-worker-${worker}`, workerName: names[worker], toyId, processId, toyName, processName, categoryName, minutes: 480, pieces, workType: 'regular' });
    });
  });
  return { entries, targets };
}
