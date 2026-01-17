import { readFile } from "fs/promises";
import { resolve } from "path";

const LOG_FILE = resolve("data/automation.log.jsonl");

export default defineEventHandler(async () => {
  try {
    const content = await readFile(LOG_FILE, "utf-8");

    // optional: nur die letzten N Zeilen
    const lines = content.split("\n").filter(Boolean);
    const tail = lines.slice(-200).join("\n");

    return {
      ok: true,
      content: tail,
    };
  } catch (err) {
    return {
      ok: false,
      content: "",
      error: "Logfile nicht lesbar",
    };
  }
});
