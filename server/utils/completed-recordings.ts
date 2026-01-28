import { readFile, writeFile, mkdir } from "fs/promises";
import { resolve, dirname } from "path";

const COMPLETED_FILE = resolve("data/plex-completed-recordings.json");

export interface CompletedRecording {
  id: string;
  completedAt: string;
  rawData: any;
}

export interface CompletedRecordingsData {
  recordings: CompletedRecording[];
}

export async function readCompletedRecordings(): Promise<CompletedRecordingsData> {
  try {
    const raw = await readFile(COMPLETED_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      recordings: [],
    };
  }
}

export async function writeCompletedRecordings(
  data: CompletedRecordingsData
): Promise<void> {
  await mkdir(dirname(COMPLETED_FILE), { recursive: true });
  await writeFile(COMPLETED_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function addCompletedRecording(
  recording: any,
  completedAt: Date
): Promise<void> {
  const data = await readCompletedRecordings();

  const id = recording.id ?? recording.key ?? String(Date.now());

  const exists = data.recordings.some((r) => r.id === id);
  if (exists) {
    return;
  }

  data.recordings.push({
    id,
    completedAt: completedAt.toISOString(),
    rawData: recording,
  });

  await writeCompletedRecordings(data);
}

export async function cleanupOldRecordings(daysToKeep: number): Promise<void> {
  const data = await readCompletedRecordings();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  data.recordings = data.recordings.filter((r) => {
    const completedAt = new Date(r.completedAt);
    return completedAt >= cutoffDate;
  });

  await writeCompletedRecordings(data);
}
