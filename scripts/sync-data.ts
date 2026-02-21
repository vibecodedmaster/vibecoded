#!/usr/bin/env -S deno run -A

import { DATA_PATH, PUBLIC_DATA_PATH } from "./lib/config.ts";
import { readAllShards, migrateFromLegacyIfNeeded } from "./lib/shard.ts";

/**
 * Merges shards into combined JSON and writes to DATA_PATH and PUBLIC_DATA_PATH.
 */
export async function syncData() {
  try {
    await migrateFromLegacyIfNeeded();
    const data = await readAllShards();
    const content = JSON.stringify(data, null, 2);
    await Deno.writeTextFile(DATA_PATH, content);
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
