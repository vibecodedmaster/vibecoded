#!/usr/bin/env -S deno run -A

import { github } from "./lib/github.ts";
import { DATA_PATH } from "./lib/config.ts";
import { ProjectsDataSchema } from "./lib/schemas.ts";

/**
 * Discovers new "Vibe Coded" projects on GitHub.
 * @param limit Maximum number of projects to discover.
 * @returns A list of repository full names.
 */
async function discover(limit = 5) {
  const content = await Deno.readTextFile(DATA_PATH).catch(() => '{"schemaVersion":1,"projects":[]}');
  const data = ProjectsDataSchema.parse(JSON.parse(content));
  const existingRepos = new Set(data.projects.map((p) => p.full_name.toLowerCase()));

  const queries = [
    'path:.cursorrules',
    'path:CLAUDE.md',
    '"vibe coded" in:description',
    'topic:vibe-coded',
  ];

  const candidates = new Set<string>();

  for (const q of queries) {
    try {
      if (candidates.size >= limit * 3) break; // Get a few more than we need to account for existing ones
      
      console.log(`Searching for: ${q}`);
      let items: any[] = [];
      
      if (q.startsWith('path:')) {
        const res = await github.searchCode(q, 30);
        items = (res.items || []).map((i: any) => i.repository.full_name);
      } else {
        const res = await github.searchRepos(q, 30);
        items = (res.items || []).map((i: any) => i.full_name);
      }

      for (const repo of items) {
        if (!existingRepos.has(repo.toLowerCase())) {
          candidates.add(repo);
        }
      }
      
      // Be nice to GitHub Search API
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.warn(`Search failed for query "${q}":`, e);
    }
  }

  return Array.from(candidates).slice(0, limit);
}

if (import.meta.main) {
  const limit = parseInt(Deno.args[0] || "5", 10);
  const found = await discover(limit);
  console.log(JSON.stringify(found, null, 2));
}
