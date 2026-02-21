#!/usr/bin/env -S deno run -A

import { scan } from "./scan.ts";
import { detect } from "./detect.ts";
import { github } from "./lib/github.ts";
import { MAX_CONCURRENCY } from "./lib/config.ts";
import { GitHubRepoSchema, GitHubUserSchema, Project } from "./lib/schemas.ts";
import { readAllShards, upsertProject, migrateFromLegacyIfNeeded } from "./lib/shard.ts";
import { syncData } from "./sync-data.ts";

/**
 * Updates a single project's metadata, AI detection, and security scan.
 * @param p The project to update.
 * @returns The updated project object.
 */
async function updateProject(p: Project): Promise<Project> {
  const fullName = p.full_name;
  console.log(`Updating ${fullName}...`);
  
  try {
    // 1. Fetch GitHub Metadata
    const [repoRaw, commits, contributors, contribsRaw, languages] = await Promise.all([
      github.getRepo(fullName),
      github.getCount(`https://api.github.com/repos/${fullName}/commits`),
      github.getCount(`https://api.github.com/repos/${fullName}/contributors`),
      github.getContributors(fullName, 10),
      github.getLanguages(fullName),
    ]);
    
    const repo = GitHubRepoSchema.parse(repoRaw);
    
    // Owner details
    let ownerDetails = p.owner;
    if (repo.owner.login) {
      try {
        const userRaw = await github.getUser(repo.owner.login);
        const user = GitHubUserSchema.parse(userRaw);
        ownerDetails = {
          login: user.login,
          avatar_url: user.avatar_url,
          url: user.html_url,
          created_at: user.created_at ?? ownerDetails?.created_at ?? null,
          followers: user.followers ?? ownerDetails?.followers ?? null,
          following: user.following ?? ownerDetails?.following ?? null,
          bio: user.bio ?? ownerDetails?.bio ?? null,
          public_repos: user.public_repos ?? ownerDetails?.public_repos ?? null,
          is_private: false,
        };
      } catch {
        // If we can't get user info, it might be private or gone, but repo still exists
        ownerDetails = {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url,
          url: repo.owner.html_url,
          created_at: ownerDetails?.created_at ?? null,
          followers: ownerDetails?.followers ?? null,
          following: ownerDetails?.following ?? null,
          bio: ownerDetails?.bio ?? null,
          public_repos: ownerDetails?.public_repos ?? null,
          is_private: true,
        };
      }
    }
    
    // Contributor details (top 10)
    let contributorDetails = p.contributorDetails;
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
    
    // 2. Detect AI Tools & PM
    let aiTools = p.aiTools;
    let emojis = p.emojis;
    let packageManager = p.packageManager;
    let commitMessageSignals = p.commitMessageSignals;
    let commitSizeSignals = p.commitSizeSignals;
    let contributorSignals = p.contributorSignals;
    let detectionSummary = p.detectionSummary;
    let hasSAST = p.hasSAST;
    let hasLinting = p.hasLinting;
    let sastEvidenceUrl = p.sastEvidenceUrl;
    let lintEvidenceUrl = p.lintEvidenceUrl;
    try {
      const d = await detect(fullName);
      aiTools = d.aiTools.length > 0 ? d.aiTools : aiTools;
      emojis = d.emojis > 0 ? d.emojis : emojis;
      packageManager = d.packageManager ?? packageManager;
      commitMessageSignals = d.commitMessageSignals;
      commitSizeSignals = d.commitSizeSignals;
      contributorSignals = d.contributorSignals;
      detectionSummary = d.detectionSummary;
      hasSAST = d.hasSAST;
      hasLinting = d.hasLinting;
      sastEvidenceUrl = d.sastEvidenceUrl ?? null;
      lintEvidenceUrl = d.lintEvidenceUrl ?? null;
    } catch (e) {
      console.warn(`Detection failed for ${fullName}:`, e);
    }
    
    // 3. Security Scan (Vulns & Secrets)
    let vulnerableDependencies = p.vulnerableDependencies;
    let vulnerabilities = p.vulnerabilities;
    try {
      const { summary, details } = await scan(fullName);
      vulnerableDependencies = summary;
      vulnerabilities = details;
    } catch (e) {
      console.warn(`Scan failed for ${fullName}:`, e);
    }
    
    return {
      ...p,
      description: repo.description ?? p.description,
      stars: repo.stargazers_count ?? p.stars,
      forks: repo.forks_count ?? p.forks,
      open_issues: repo.open_issues_count ?? p.open_issues,
      license: repo.license?.name ?? p.license,
      topics: repo.topics && repo.topics.length > 0 ? repo.topics : p.topics,
      size: repo.size ?? p.size,
      default_branch: repo.default_branch ?? p.default_branch,
      commits: commits ?? p.commits,
      contributors: contributors ?? p.contributors,
      language: repo.language ?? p.language,
      languages: Object.keys(languages).length > 0 ? languages : p.languages,
      is_archived: repo.archived ?? p.is_archived,
      owner: ownerDetails,
      contributorDetails,
      aiTools,
      emojis,
      packageManager,
      commitMessageSignals,
      commitSizeSignals,
      contributorSignals,
      detectionSummary,
      hasSAST: hasSAST || undefined,
      hasLinting: hasLinting || undefined,
      sastEvidenceUrl: sastEvidenceUrl ?? undefined,
      lintEvidenceUrl: lintEvidenceUrl ?? undefined,
      vulnerableDependencies,
      vulnerabilities,
      lastUpdated: new Date().toISOString(),
    };
  } catch (e) {
    console.error(`Failed to update ${fullName}:`, e);
    return p; // Return original project on failure
  }
}

/**
 * Updates all projects in the registry with concurrency control.
 */
async function updateAll() {
  await migrateFromLegacyIfNeeded();
  const data = await readAllShards();
  const projects = data.projects;

  console.log(`Updating ${projects.length} projects with concurrency limit ${MAX_CONCURRENCY}...`);

  const queue = [...projects];
  const workers = Array(Math.min(MAX_CONCURRENCY, queue.length))
    .fill(null)
    .map(async () => {
      while (queue.length > 0) {
        const p = queue.shift();
        if (!p) break;
        const updated = await updateProject(p);
        await upsertProject(updated);
      }
    });

  await Promise.all(workers);
  await syncData();
  console.log("Updated all projects.");
}

if (import.meta.main) {
  await updateAll();
}
