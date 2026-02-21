#!/usr/bin/env -S deno run -A

import { GITHUB_RE, DATA_PATH, PUBLIC_DATA_PATH } from "./lib/config.ts";
import { github } from "./lib/github.ts";
import { 
  GitHubRepoSchema, 
  GitHubUserSchema, 
  ProjectSchema, 
  ProjectsDataSchema,
  Project
} from "./lib/schemas.ts";

/**
 * Parses a GitHub owner/repo string or URL.
 * @param input The GitHub URL or owner/repo string.
 * @returns The parsed owner/repo string and full URL, or null if invalid.
 */
function parse(input: string): { full_name: string; url: string } | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(GITHUB_RE);
  if (!m) return null;
  const full = `${m[1]}/${m[2]}`;
  return { full_name: full, url: `https://github.com/${full}` };
}

/**
 * Adds a new project to the registry, fetching all metadata and scanning for vulnerabilities.
 * @param input GitHub owner/repo string or URL.
 * @returns true if successful, false if project already exists.
 */
export async function add(input: string, force = false): Promise<boolean> {
  const p = parse(input);
  if (!p) {
    throw new Error("Invalid: expected owner/repo or GitHub URL");
  }
  
  const content = await Deno.readTextFile(DATA_PATH).catch(() => '{"schemaVersion":1,"projects":[]}');
  const data = ProjectsDataSchema.parse(JSON.parse(content));
  const projects = data.projects;
  
  const existingIdx = projects.findIndex((x) => x.full_name === p.full_name);
  if (existingIdx >= 0 && !force) {
    if (import.meta.main) console.log("Already exists:", p.full_name);
    return false;
  }
  
  const now = new Date().toISOString();
  let project: Project = ProjectSchema.parse({
    full_name: p.full_name,
    url: p.url,
    lastUpdated: now,
  });
  
  try {
    const repoRaw = await github.getRepo(p.full_name);
    const repo = GitHubRepoSchema.parse(repoRaw);
    
    const [languages, commits, contributors, contribsRaw] = await Promise.all([
      github.getLanguages(p.full_name).catch(() => ({})),
      github.getCount(`${github.constructor.name === "GitHubClient" ? "https://api.github.com" : ""}/repos/${p.full_name}/commits`),
      github.getCount(`${github.constructor.name === "GitHubClient" ? "https://api.github.com" : ""}/repos/${p.full_name}/contributors`),
      github.getContributors(p.full_name, 10).catch(() => []),
    ]);
    
    // AI Tools & Package Manager detection
    let aiTools: Array<{ name: string; detected_via: "file" | "commits"; evidence_url: string }> = [];
    let emojis = 0;
    let packageManager: { name: string; detected_via: string; evidence_url: string } | null = null;
    let commitMessageSignals: {
      sampleSize: number;
      avgMessageLength: number;
      emDashCount: number;
      enDashCount: number;
      aiMentionCount: number;
    } | null = null;
    let commitSizeSignals: {
      sampledCommits: number;
      avgChanges: number;
      medianChanges: number;
      largeCommitCount: number;
    } | null = null;
    let contributorSignals: {
      hasClaudeBotContributor: boolean;
      matchedBots: string[];
    } | null = null;
    let detectionSummary: {
      score: number;
      level: "low" | "medium" | "high";
      reasons: string[];
    } | null = null;
    try {
      const { detect } = await import("./detect.ts");
      const d = await detect(p.full_name);
      aiTools = d.aiTools;
      emojis = d.emojis;
      packageManager = d.packageManager;
      commitMessageSignals = d.commitMessageSignals;
      commitSizeSignals = d.commitSizeSignals;
      contributorSignals = d.contributorSignals;
      detectionSummary = d.detectionSummary;
    } catch { /* ignore */ }
    
    // Owner details
    let ownerDetails: any = null;
    if (repo.owner.login) {
      try {
        const userRaw = await github.getUser(repo.owner.login);
        const user = GitHubUserSchema.parse(userRaw);
        ownerDetails = {
          login: user.login,
          avatar_url: user.avatar_url,
          url: user.html_url,
          created_at: user.created_at ?? null,
          followers: user.followers ?? null,
          following: user.following ?? null,
          bio: user.bio ?? null,
          public_repos: user.public_repos ?? null,
          is_private: false,
        };
      } catch {
        ownerDetails = {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url,
          url: repo.owner.html_url,
          is_private: true,
        };
      }
    }
    
    // Contributor details (top 10)
    let contributorDetails: any = null;
    if (Array.isArray(contribsRaw)) {
      contributorDetails = await Promise.all(
        contribsRaw.slice(0, 10).map(async (c: any) => {
          try {
            const uRaw = await github.getUser(c.login);
            const u = GitHubUserSchema.parse(uRaw);
            return {
              login: c.login,
              avatar_url: c.avatar_url,
              url: c.html_url ?? `https://github.com/${c.login}`,
              created_at: u.created_at ?? null,
              followers: u.followers ?? null,
              following: u.following ?? null,
            };
          } catch {
            return {
              login: c.login,
              avatar_url: c.avatar_url,
              url: c.html_url ?? `https://github.com/${c.login}`,
            };
          }
        })
      );
    }
    
    project = ProjectSchema.parse({
      full_name: p.full_name,
      url: p.url,
      description: repo.description ?? null,
      stars: repo.stargazers_count ?? 0,
      forks: repo.forks_count ?? null,
      open_issues: repo.open_issues_count ?? null,
      license: repo.license?.name ?? null,
      topics: repo.topics && repo.topics.length > 0 ? repo.topics : null,
      size: repo.size ?? null,
      default_branch: repo.default_branch ?? null,
      commits: commits ?? null,
      contributors: contributors ?? null,
      contributorDetails: contributorDetails?.length ? contributorDetails : null,
      created_at: repo.created_at ?? null,
      language: repo.language ?? null,
      languages: Object.keys(languages).length > 0 ? languages : null,
      is_archived: repo.archived ?? false,
      owner: ownerDetails,
      aiTools: aiTools.length > 0 ? aiTools : null,
      emojis: emojis > 0 ? emojis : null,
      packageManager: packageManager,
      commitMessageSignals,
      commitSizeSignals,
      contributorSignals,
      detectionSummary,
      lastUpdated: now,
    });
    
  } catch (e) {
    if (import.meta.main) console.warn(`Could not fetch details for ${p.full_name}:`, e);
  }
  
  if (existingIdx >= 0) {
    projects[existingIdx] = project;
  } else {
    projects.push(project);
  }
  projects.sort((a, b) => a.full_name.localeCompare(b.full_name));
  
  const finalData = { schemaVersion: 1, projects };
  await Deno.writeTextFile(DATA_PATH, JSON.stringify(finalData, null, 2));
  await Deno.writeTextFile(PUBLIC_DATA_PATH, JSON.stringify(finalData, null, 2));
  
  if (import.meta.main) {
    console.log("Added:", p.full_name);
    try {
      const { scan } = await import("./scan.ts");
      const { summary, details } = await scan(p.full_name);
      const idx = projects.findIndex((x) => x.full_name === p.full_name);
      if (idx >= 0 && summary.length > 0) {
        projects[idx].vulnerableDependencies = summary;
        projects[idx].vulnerabilities = details;
        const updatedData = { schemaVersion: 1, projects };
        await Deno.writeTextFile(DATA_PATH, JSON.stringify(updatedData, null, 2));
        await Deno.writeTextFile(PUBLIC_DATA_PATH, JSON.stringify(updatedData, null, 2));
        console.log(`Scanned: ${summary.length} vulnerable dependencies`);
      }
    } catch (e) {
      console.warn("Scan failed:", e);
    }
  }
  
  return true;
}

if (import.meta.main) {
  const input = Deno.args.find((arg) => !arg.startsWith("-"));
  const force = Deno.args.includes("--update") || Deno.args.includes("--force");
  
  if (!input) {
    console.error("Usage: deno run -A scripts/add.ts <owner/repo|url> [--update]");
    Deno.exit(1);
  }
  await add(input, force);
}
