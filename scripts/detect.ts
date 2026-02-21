#!/usr/bin/env -S deno run -A

import { GITHUB_RE } from "./lib/config.ts";
import { github } from "./lib/github.ts";

/**
 * Parses a GitHub owner/repo string or URL into a simple owner/repo string.
 * @param input The GitHub URL or owner/repo string.
 * @returns The parsed owner/repo string, or null if invalid.
 */
export function parse(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(GITHUB_RE);
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}

/**
 * Checks for signs of AI-assisted development tools (Cursor/Claude).
 * @param fullName The GitHub repository's full name (owner/repo).
 * @returns An object containing flags for detected tools and a list of tool names.
 */
async function hasCursorOrClaude(fullName: string): Promise<{
  aiTools: Array<{ name: string; detected_via: "file" | "commits"; evidence_url: string }>;
}> {
  const paths = [".cursor", ".cursorrules", ".cursor/rules", "CLAUDE.md", "claude.md"];
  const aiTools: Array<{ name: string; detected_via: "file" | "commits"; evidence_url: string }> = [];
  
  for (const p of paths) {
    if (await github.hasPath(fullName, p)) {
      const url = `https://github.com/${fullName}/tree/main/${p}`;
      if (p.includes("cursor")) aiTools.push({ name: "cursor", detected_via: "file", evidence_url: url });
      if (p.toLowerCase().includes("claude")) aiTools.push({ name: "claude", detected_via: "file", evidence_url: url });
    }
  }
  
  try {
    const commits = await github.getRecentCommits(fullName);
    const seenTools = new Set(aiTools.map(t => t.name));
    for (const c of (commits as Array<{ commit?: { message?: string }; html_url: string }>)) {
      const msg = (c.commit?.message ?? "").toLowerCase();
      const url = c.html_url;
      if (!seenTools.has("cursor") && msg.includes("cursor")) {
        aiTools.push({ name: "cursor", detected_via: "commits", evidence_url: url });
        seenTools.add("cursor");
      }
      if (!seenTools.has("claude") && msg.includes("claude")) {
        aiTools.push({ name: "claude", detected_via: "commits", evidence_url: url });
        seenTools.add("claude");
      }
      if (!seenTools.has("gemini") && msg.includes("gemini")) {
        aiTools.push({ name: "gemini", detected_via: "commits", evidence_url: url });
        seenTools.add("gemini");
      }
      if (!seenTools.has("vibe") && (msg.includes("vibe coded") || msg.includes("vibe-coded"))) {
        aiTools.push({ name: "vibe", detected_via: "commits", evidence_url: url });
        seenTools.add("vibe");
      }
    }
  } catch (e) {
    console.warn(`Failed to fetch commits for ${fullName}:`, e);
  }
  
  return { aiTools };
}

/**
 * Fetches the total count of emoji reactions in the last ~500 issues/PRs.
 * @param fullName The GitHub repository's full name (owner/repo).
 * @returns The total number of emoji reactions found.
 */
async function fetchEmojiCount(fullName: string): Promise<number> {
  let total = 0;
  let page = 1;
  for (let i = 0; i < 5; i++) {
    try {
      const res = await github.fetchWithRetry(
        `https://api.github.com/repos/${fullName}/issues?state=all&per_page=100&page=${page}`
      );
      const issues = (await res.json()) as Array<{ reactions?: { total_count?: number } }>;
      if (issues.length === 0) break;
      for (const issue of issues) {
        total += issue.reactions?.total_count ?? 0;
      }
      if (issues.length < 100) break;
      page++;
    } catch {
      break;
    }
  }
  return total;
}

/**
 * Detects the project's package manager based on presence of specific lock files.
 * @param fullName The GitHub repository's full name (owner/repo).
 * @returns The detected package manager name or null if none found.
 */
async function detectPackageManager(fullName: string): Promise<{ name: string; detected_via: string; evidence_url: string } | null> {
  const mapping: Record<string, string> = {
    "package.json": "npm",
    "yarn.lock": "yarn",
    "pnpm-lock.yaml": "pnpm",
    "bun.lockb": "bun",
    "go.mod": "go",
    "Cargo.toml": "cargo",
    "requirements.txt": "pip",
    "pyproject.toml": "poetry",
    "Pipfile": "pipenv",
    "Gemfile": "bundler",
    "composer.json": "composer",
    "mix.exs": "mix",
    "deno.json": "deno",
    "deno.jsonc": "deno",
    "pom.xml": "maven",
    "build.gradle": "gradle",
  };
  
  for (const [file, pm] of Object.entries(mapping)) {
    if (await github.hasPath(fullName, file)) {
      return { 
        name: pm, 
        detected_via: file, 
        evidence_url: `https://github.com/${fullName}/blob/main/${file}` 
      };
    }
  }
  return null;
}

/**
 * Performs full detection of AI tools, emojis, and package manager.
 * @param fullName The GitHub repository's full name (owner/repo).
 * @returns An object containing the detection results.
 */
export async function detect(fullName: string): Promise<{
  aiTools: Array<{ name: string; detected_via: "file" | "commits"; evidence_url: string }>;
  emojis: number;
  packageManager: { name: string; detected_via: string; evidence_url: string } | null;
}> {
  const { aiTools } = await hasCursorOrClaude(fullName);
  const emojis = await fetchEmojiCount(fullName);
  const packageManager = await detectPackageManager(fullName);
  return { aiTools, emojis, packageManager };
}

if (import.meta.main) {
  const input = Deno.args[0];
  if (!input) {
    console.error("Usage: deno run -A scripts/detect.ts <owner/repo|url>");
    Deno.exit(1);
  }
  const fullName = parse(input);
  if (!fullName) {
    console.error("Invalid: expected owner/repo or GitHub URL");
    Deno.exit(1);
  }
  const { aiTools, emojis } = await detect(fullName);
  console.log("aiTools:", aiTools.join(", ") || "none");
  console.log("emojis:", emojis);
}
