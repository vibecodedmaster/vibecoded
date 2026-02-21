import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

/**
 * Schema for GitHub Repository API response.
 */
export const GitHubRepoSchema = z.object({
  full_name: z.string(),
  description: z.string().nullable().optional(),
  stargazers_count: z.number(),
  created_at: z.string(),
  language: z.string().nullable().optional(),
  archived: z.boolean(),
  html_url: z.string(),
  forks_count: z.number().optional(),
  open_issues_count: z.number().optional(),
  license: z.object({
    name: z.string(),
  }).nullable().optional(),
  topics: z.array(z.string()).optional(),
  size: z.number().optional(),
  default_branch: z.string().optional(),
  owner: z.object({
    login: z.string(),
    avatar_url: z.string(),
    html_url: z.string(),
  }),
});

export type GitHubRepo = z.infer<typeof GitHubRepoSchema>;

/**
 * Schema for GitHub User API response.
 */
export const GitHubUserSchema = z.object({
  login: z.string(),
  avatar_url: z.string(),
  html_url: z.string(),
  created_at: z.string().optional(),
  followers: z.number().optional(),
  following: z.number().optional(),
  bio: z.string().nullable().optional(),
  public_repos: z.number().optional(),
});

export type GitHubUser = z.infer<typeof GitHubUserSchema>;

/**
 * Schema for vulnerability details.
 */
export const VulnDetailSchema = z.object({
  pkg: z.string(),
  version: z.string(),
  cve: z.string(),
  severity: z.string(),
  title: z.string(),
  fixedVersion: z.string().optional(),
  type: z.enum(["vuln", "secret"]).default("vuln"),
  target: z.string().optional(),
  targetUrl: z.string().optional(),
});

export type VulnDetail = z.infer<typeof VulnDetailSchema>;

/**
 * Schema for a single project in our registry.
 */
export const ProjectSchema = z.object({
  full_name: z.string(),
  url: z.string(),
  description: z.string().nullable().optional(),
  stars: z.number().default(0),
  commits: z.number().nullable().optional(),
  contributors: z.number().nullable().optional(),
  forks: z.number().nullable().optional(),
  open_issues: z.number().nullable().optional(),
  license: z.string().nullable().optional(),
  topics: z.array(z.string()).nullable().optional(),
  size: z.number().nullable().optional(),
  default_branch: z.string().nullable().optional(),
  contributorDetails: z.array(z.object({
    login: z.string(),
    avatar_url: z.string(),
    url: z.string(),
    created_at: z.string().nullable().optional(),
    followers: z.number().nullable().optional(),
    following: z.number().nullable().optional(),
  })).nullable().optional(),
  created_at: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  languages: z.record(z.number()).nullable().optional(),
  is_archived: z.boolean().default(false),
  owner: z.object({
    login: z.string(),
    avatar_url: z.string(),
    url: z.string(),
    created_at: z.string().nullable().optional(),
    followers: z.number().nullable().optional(),
    following: z.number().nullable().optional(),
    bio: z.string().nullable().optional(),
    public_repos: z.number().nullable().optional(),
    is_private: z.boolean().default(false),
  }).nullable().optional(),
  packageManager: z.object({
    name: z.string(),
    detected_via: z.string(),
    evidence_url: z.string().optional(),
  }).nullable().optional(),
  commitMessageSignals: z.object({
    sampleSize: z.number(),
    avgMessageLength: z.number(),
    emDashCount: z.number(),
    enDashCount: z.number(),
    aiMentionCount: z.number(),
  }).nullable().optional(),
  commitSizeSignals: z.object({
    sampledCommits: z.number(),
    avgChanges: z.number(),
    medianChanges: z.number(),
    largeCommitCount: z.number(),
  }).nullable().optional(),
  contributorSignals: z.object({
    hasClaudeBotContributor: z.boolean(),
    matchedBots: z.array(z.string()),
  }).nullable().optional(),
  detectionSummary: z.object({
    score: z.number(),
    level: z.enum(["low", "medium", "high"]),
    reasons: z.array(z.string()),
  }).nullable().optional(),
  aiTools: z.array(z.object({
    name: z.string(),
    detected_via: z.enum(["file", "commits"]),
    evidence_url: z.string().optional(),
  })).nullable().optional(),
  vulnerableDependencies: z.array(z.string()).optional(),
  vulnerabilities: z.array(VulnDetailSchema).optional(),
  proof_sources: z.array(z.object({
    label: z.string(),
    url: z.string(),
  })).nullable().optional(),
  lastUpdated: z.string().optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

/**
 * Schema for the projects.json file.
 */
export const ProjectsDataSchema = z.object({
  schemaVersion: z.number(),
  projects: z.array(ProjectSchema),
});

export type ProjectsData = z.infer<typeof ProjectsDataSchema>;

/**
 * Schema for the denied.json file.
 */
export const DeniedDataSchema = z.object({
  schemaVersion: z.number(),
  denied: z.array(z.string()),
});

export type DeniedData = z.infer<typeof DeniedDataSchema>;
