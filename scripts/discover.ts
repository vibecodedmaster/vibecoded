#!/usr/bin/env -S deno run -A

import { github } from "./lib/github.ts";
import { DATA_PATH } from "./lib/config.ts";
import { ProjectsDataSchema } from "./lib/schemas.ts";
import { detect } from "./detect.ts";

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
    '"vibe coded" in:message',
    'claude in:message',
    'gemini in:message',
  ];

  const candidates = new Set<string>();

  for (const q of queries) {
    try {
      if (candidates.size >= limit * 3) break; // Get a few more than we need to account for existing ones
      
      console.error(`Searching for: ${q}`);
      let items: any[] = [];
      
      if (q.startsWith('path:')) {
        const res = await github.searchCode(q, 30);
        items = (res.items || []).map((i: any) => i.repository.full_name);
      } else if (q.includes('in:message')) {
        const res = await github.searchCommits(q, 30);
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

  // Verify candidates
  console.error(`Found ${candidates.size} candidates. Verifying...`);
  const verified: string[] = [];
  for (const repo of candidates) {
    if (verified.length >= limit) break;
    try {
      const d = await detect(repo);
      if (d.aiTools && d.aiTools.length > 0) {
        console.error(`Verified: ${repo} (Tools: ${d.aiTools.map(t => t.name).join(", ")})`);
        verified.push(repo);
      } else {
        console.error(`Skipped: ${repo} (No AI indicators found)`);
      }
    } catch (e) {
      console.warn(`Verification failed for ${repo}:`, e);
    }
    // Be nice to GitHub API
    await new Promise(r => setTimeout(r, 1000));
  }

  return verified;
}

if (import.meta.main) {
  const limit = parseInt(Deno.args[0] || "5", 10);
  const found = await discover(limit);
  console.log(JSON.stringify(found));
}
