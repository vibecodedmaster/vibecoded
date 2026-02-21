#!/usr/bin/env -S deno run -A

import { github } from "./lib/github.ts";
import { DATA_PATH, DENIED_PATH } from "./lib/config.ts";
import { ProjectsDataSchema, DeniedDataSchema } from "./lib/schemas.ts";
import { detect } from "./detect.ts";

/**
 * Discovered project metadata.
 */
interface DiscoveredProject {
  full_name: string;
  description: string | null;
  stars: number;
  aiTools: Array<{ name: string; detected_via: string; evidence_url?: string }>;
}

/**
 * Discovers new "Vibe Coded" projects on GitHub.
 * @param limit Maximum number of projects to discover.
 * @returns A list of discovered project objects.
 */
async function discover(limit = 5) {
  const content = await Deno.readTextFile(DATA_PATH).catch(() => '{"schemaVersion":1,"projects":[]}');
  const data = ProjectsDataSchema.parse(JSON.parse(content));
  const existingRepos = new Set(data.projects.map((p) => p.full_name.toLowerCase()));

  const deniedContent = await Deno.readTextFile(DENIED_PATH).catch(() => '{"schemaVersion":1,"denied":[]}');
  const deniedData = DeniedDataSchema.parse(JSON.parse(deniedContent));
  const deniedRepos = new Set(deniedData.denied.map((r) => r.toLowerCase()));

  const queries = [
    'path:.cursorrules',
    'path:CLAUDE.md',
    '"vibe coded" in:description',
    'topic:vibe-coded',
    '"vibe coded" in:message',
    'claude in:message',
    'gemini in:message',
  ];

  const candidates = new Map<string, { description?: string; stars?: number }>();

  for (const q of queries) {
    try {
      if (candidates.size >= limit * 3) break; // Get a few more than we need to account for existing ones
      
      console.error(`Searching for: ${q}`);
      let items: any[] = [];
      
      if (q.startsWith('path:')) {
        const res = await github.searchCode(q, 30);
        items = (res.items || []).map((i: any) => ({
          full_name: i.repository.full_name,
          description: i.repository.description,
          stars: i.repository.stargazers_count,
        }));
      } else if (q.includes('in:message')) {
        const res = await github.searchCommits(q, 30);
        items = (res.items || []).map((i: any) => ({
          full_name: i.repository.full_name,
          description: i.repository.description,
          stars: i.repository.stargazers_count,
        }));
      } else {
        const res = await github.searchRepos(q, 30);
        items = (res.items || []).map((i: any) => ({
          full_name: i.full_name,
          description: i.description,
          stars: i.stargazers_count,
        }));
      }

      for (const item of items) {
        const lowerName = item.full_name.toLowerCase();
        if (!existingRepos.has(lowerName) && !deniedRepos.has(lowerName)) {
          candidates.set(item.full_name, {
            description: item.description,
            stars: item.stars,
          });
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
  const verified: DiscoveredProject[] = [];
  for (const [fullName, info] of candidates.entries()) {
    if (verified.length >= limit) break;
    try {
      const d = await detect(fullName);
      if (d.aiTools && d.aiTools.length > 0) {
        console.error(`Verified: ${fullName} (Tools: ${d.aiTools.map(t => t.name).join(", ")})`);
        verified.push({
          full_name: fullName,
          description: info.description ?? null,
          stars: info.stars ?? 0,
          aiTools: d.aiTools,
        });
      } else {
        console.error(`Skipped: ${fullName} (No AI indicators found)`);
      }
    } catch (e) {
      console.warn(`Verification failed for ${fullName}:`, e);
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
