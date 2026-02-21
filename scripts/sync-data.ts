#!/usr/bin/env -S deno run -A

import { DATA_PATH, PUBLIC_DATA_PATH } from "./lib/config.ts";

/**
 * Synchronizes the master projects.json data file to the web application's public data directory.
 */
async function syncData() {
  try {
    const content = await Deno.readTextFile(DATA_PATH);
    await Deno.writeTextFile(PUBLIC_DATA_PATH, content);
    console.log("Synced data to public");
  } catch (e) {
    console.error("Failed to sync data:", e);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await syncData();
}
