#!/usr/bin/env -S deno run -A

import { DENIED_PATH } from "./lib/config.ts";
import { DeniedDataSchema } from "./lib/schemas.ts";

/**
 * Adds a repository to the denylist.
 * @param fullName owner/repo to deny.
 */
async function deny(fullName: string) {
  const content = await Deno.readTextFile(DENIED_PATH).catch(() => '{"schemaVersion":1,"denied":[]}');
  const data = DeniedDataSchema.parse(JSON.parse(content));
  
  const lowerName = fullName.toLowerCase();
  if (data.denied.some(r => r.toLowerCase() === lowerName)) {
    console.log(`Repo ${fullName} is already denied.`);
    return;
  }

  data.denied.push(fullName);
  data.denied.sort();
  
  await Deno.writeTextFile(DENIED_PATH, JSON.stringify(data, null, 2));
  console.log(`Added ${fullName} to denylist.`);
}

if (import.meta.main) {
  const repo = Deno.args[0];
  if (!repo) {
    console.error("Usage: deno run -A scripts/deny.ts <owner/repo>");
    Deno.exit(1);
  }
  await deny(repo);
}
