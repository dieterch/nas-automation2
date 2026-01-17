import { appendFileSync, readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const LOG_FILE = resolve("data/automation.log.jsonl");

type LogEntry = {
  first: string;
  last: string;
  count: number;
  [key: string]: any;
};

function ts() {
  return new Date().toLocaleString("de-AT", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function logAutomation(entry: Record<string, any>) {
  // const now = new Date().toISOString();

  const last = readLastEntry();

  // Vergleich: alles außer Zeit & Zähler
  if (last && isSameLogicalEntry(last, entry)) {
    last.last = ts();
    last.count += 1;
    rewriteLastLine(last);
    return;
  }

  const line: LogEntry = {
    first: ts(),
    last: ts(),
    count: 1,
    ...entry,
  };

  appendFileSync(LOG_FILE, JSON.stringify(line) + "\n");
}

function readLastEntry(): LogEntry | null {
  if (!existsSync(LOG_FILE)) return null;

  const lines = readFileSync(LOG_FILE, "utf-8").trimEnd().split("\n");

  if (lines.length === 0) return null;

  return JSON.parse(lines[lines.length - 1]);
}

function rewriteLastLine(entry: LogEntry) {
  const lines = readFileSync(LOG_FILE, "utf-8").trimEnd().split("\n");

  lines[lines.length - 1] = JSON.stringify(entry);

  writeFileSync(LOG_FILE, lines.join("\n") + "\n");
}

function isSameLogicalEntry(last: LogEntry, next: Record<string, any>) {
  for (const key of Object.keys(next)) {
    if (last[key] !== next[key]) return false;
  }
  return true;
}
