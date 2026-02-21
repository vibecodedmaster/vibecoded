#!/usr/bin/env -S deno run -A

import { github } from "./lib/github.ts";
import { DENIED_PATH } from "./lib/config.ts";
import { DeniedDataSchema } from "./lib/schemas.ts";
import { readAllShards, migrateFromLegacyIfNeeded } from "./lib/shard.ts";
import { detect, shouldCreateDiscoveryPr } from "./detect.ts";

/**
 * Discovered project metadata.
 */
interface DiscoveredProject {
  full_name: string;
  description: string | null;
  stars: number;
  aiTools: Array<{ name: string; detected_via: string; evidence_url?: string }>;
  emojis: number;
  packageManager?: { name: string; detected_via: string; evidence_url?: string } | null;
  commitMessageSignals: {
    sampleSize: number;
    avgMessageLength: number;
    emDashCount: number;
    enDashCount: number;
    aiMentionCount: number;
  };
  commitSizeSignals: {
    sampledCommits: number;
    avgChanges: number;
    medianChanges: number;
    largeCommitCount: number;
  };
  contributorSignals: {
    hasClaudeBotContributor: boolean;
    matchedBots: string[];
  };
  detectionSummary: {
    score: number;
    level: "low" | "medium" | "high";
    reasons: string[];
  };
}

interface DiscoveryCandidate {
  description?: string;
  stars?: number;
  score: number;
  matchedQueries: string[];
}

/**
 * Discovers new "Vibe Coded" projects on GitHub.
 * @param limit Maximum number of projects to discover.
 * @returns A list of discovered project objects.
 */
async function discover(limit = 5) {
  await migrateFromLegacyIfNeeded();
  const data = await readAllShards();
  const existingRepos = new Set(data.projects.map((p) => p.full_name.toLowerCase()));

  const deniedContent = await Deno.readTextFile(DENIED_PATH).catch(() => '{"schemaVersion":1,"denied":[]}');
  const deniedData = DeniedDataSchema.parse(JSON.parse(deniedContent));
  const deniedRepos = new Set(deniedData.denied.map((r) => r.toLowerCase()));

  const queries = [
    {
      query: "archived:false fork:false path:.cursorrules",
      type: "code" as const,
      score: 4,
    },
    {
      query: "archived:false fork:false path:.cursor/rules",
      type: "code" as const,
      score: 4,
    },
    {
      query: "archived:false fork:false path:CLAUDE.md",
      type: "code" as const,
      score: 4,
    },
    {
      query: "archived:false fork:false path:AGENTS.md",
      type: "code" as const,
      score: 3,
    },
    {
      query: "archived:false fork:false path:.windsurfrules",
      type: "code" as const,
      score: 3,
    },
    {
      query: 'topic:vibe-coded archived:false fork:false',
      type: "repo" as const,
      score: 5,
    },
    {
      query: '"vibe coded" in:description archived:false fork:false',
      type: "repo" as const,
      score: 4,
    },
    {
      query: 'cursor in:message archived:false fork:false',
      type: "commit" as const,
      score: 2,
    },
    {
      query: 'claude in:message archived:false fork:false',
      type: "commit" as const,
      score: 2,
    },
    {
      query: 'copilot in:message archived:false fork:false',
      type: "commit" as const,
      score: 2,
    },
    {
      query: 'gemini in:message archived:false fork:false',
      type: "commit" as const,
      score: 2,
    },
  ];

  const candidates = new Map<string, DiscoveryCandidate>();

  for (const search of queries) {
    try {
      if (candidates.size >= limit * 8) break;

      console.error(`Searching for: ${search.query}`);
      let items: any[] = [];

      if (search.type === "code") {
        const res = await github.searchCode(search.query, 30);
        items = (res.items || []).map((i: any) => ({
          full_name: i.repository.full_name,
          description: i.repository.description,
          stars: i.repository.stargazers_count,
        }));
      } else if (search.type === "commit") {
        const res = await github.searchCommits(search.query, 30);
        items = (res.items || []).map((i: any) => ({
          full_name: i.repository.full_name,
          description: i.repository.description,
          stars: i.repository.stargazers_count,
        }));
      } else {
        const res = await github.searchRepos(search.query, 30);
        items = (res.items || []).map((i: any) => ({
          full_name: i.full_name,
          description: i.description,
          stars: i.stargazers_count,
        }));
      }

      for (const item of items) {
        const lowerName = item.full_name.toLowerCase();
        if (!existingRepos.has(lowerName) && !deniedRepos.has(lowerName)) {
          const existing = candidates.get(item.full_name);
          const stars = item.stars ?? existing?.stars ?? 0;
          const starScore = Math.min(3, Math.floor(stars / 25));
          const baseScore = search.score + starScore;
          if (!existing) {
            candidates.set(item.full_name, {
              description: item.description,
              stars,
              score: baseScore,
              matchedQueries: [search.query],
            });
            continue;
          }
          existing.description = existing.description ?? item.description;
          existing.stars = Math.max(existing.stars ?? 0, stars);
          existing.score += baseScore;
          if (!existing.matchedQueries.includes(search.query)) {
            existing.matchedQueries.push(search.query);
          }
        }
      }

      await new Promise((r) => setTimeout(r, 1500));
    } catch (e) {
      console.warn(`Search failed for query "${search.query}":`, e);
    }
  }

  const prioritizedCandidates = Array.from(candidates.entries()).sort((a, b) => {
    const scoreDiff = b[1].score - a[1].score;
    if (scoreDiff !== 0) return scoreDiff;
    return (b[1].stars ?? 0) - (a[1].stars ?? 0);
  }).slice(0, limit * 12);

  console.error(`Found ${candidates.size} candidates. Verifying top ${prioritizedCandidates.length}...`);
  const verified: DiscoveredProject[] = [];
  for (const [fullName, info] of prioritizedCandidates) {
    if (verified.length >= limit) break;
    try {
      const d = await detect(fullName);
      const shouldCreatePr = shouldCreateDiscoveryPr(d.detectionSummary, {
        aiTools: d.aiTools,
        contributorSignals: d.contributorSignals,
        commitMessageSignals: d.commitMessageSignals,
      });
      if (shouldCreatePr) {
        console.error(`Verified: ${fullName} (Tools: ${d.aiTools.map(t => t.name).join(", ")})`);
        verified.push({
          full_name: fullName,
          description: info.description ?? null,
          stars: info.stars ?? 0,
          aiTools: d.aiTools,
          emojis: d.emojis,
          packageManager: d.packageManager,
          commitMessageSignals: d.commitMessageSignals,
          commitSizeSignals: d.commitSizeSignals,
          contributorSignals: d.contributorSignals,
          detectionSummary: d.detectionSummary,
        });
      } else {
        console.error(
          `Skipped: ${fullName} (score=${d.detectionSummary.score}, level=${d.detectionSummary.level})`,
        );
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
