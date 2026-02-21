#!/usr/bin/env -S deno run -A

import { GITHUB_RE } from "./lib/config.ts";
import { github } from "./lib/github.ts";

type DetectionEvidence = { name: string; detected_via: "file" | "commits"; evidence_url: string };

export interface CommitMessageSignals {
  sampleSize: number;
  avgMessageLength: number;
  emDashCount: number;
  enDashCount: number;
  aiMentionCount: number;
}

export interface CommitSizeSignals {
  sampledCommits: number;
  avgChanges: number;
  medianChanges: number;
  largeCommitCount: number;
}

export interface ContributorSignals {
  hasClaudeBotContributor: boolean;
  matchedBots: string[];
}

export interface DetectionSummary {
  score: number;
  level: "low" | "medium" | "high";
  reasons: string[];
}

export const VIBE_SCORE_PR_THRESHOLD = 7;

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
  aiTools: DetectionEvidence[];
  commits: Array<{ commit?: { message?: string }; html_url: string; sha: string }>;
}> {
  const aiTools: DetectionEvidence[] = [];
  const seenTools = new Set<string>();

  const repoInfo = await github.getRepo(fullName).catch(() => null);
  const defaultBranch = typeof repoInfo?.default_branch === "string" && repoInfo.default_branch.length > 0
    ? repoInfo.default_branch
    : "main";

  const fileSignals: Array<{ tool: string; path: string; isDirectory?: boolean }> = [
    { tool: "cursor", path: ".cursor", isDirectory: true },
    { tool: "cursor", path: ".cursorrules" },
    { tool: "cursor", path: ".cursor/rules", isDirectory: true },
    { tool: "claude", path: "CLAUDE.md" },
    { tool: "claude", path: "claude.md" },
    { tool: "claude", path: "AGENTS.md" },
    { tool: "copilot", path: ".github/copilot-instructions.md" },
    { tool: "windsurf", path: ".windsurfrules" },
    { tool: "gemini", path: "GEMINI.md" },
    { tool: "aider", path: ".aider.conf.yml" },
  ];

  for (const signal of fileSignals) {
    if (!(await github.hasPath(fullName, signal.path))) continue;
    if (seenTools.has(signal.tool)) continue;
    const mode = signal.isDirectory ? "tree" : "blob";
    aiTools.push({
      name: signal.tool,
      detected_via: "file",
      evidence_url: `https://github.com/${fullName}/${mode}/${defaultBranch}/${signal.path}`,
    });
    seenTools.add(signal.tool);
  }

  let commits: Array<{ commit?: { message?: string }; html_url: string; sha: string }> = [];
  try {
    commits = await github.getRecentCommits(fullName);
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
      if (!seenTools.has("copilot") && msg.includes("copilot")) {
        aiTools.push({ name: "copilot", detected_via: "commits", evidence_url: url });
        seenTools.add("copilot");
      }
      if (!seenTools.has("windsurf") && msg.includes("windsurf")) {
        aiTools.push({ name: "windsurf", detected_via: "commits", evidence_url: url });
        seenTools.add("windsurf");
      }
      if (!seenTools.has("aider") && msg.includes("aider")) {
        aiTools.push({ name: "aider", detected_via: "commits", evidence_url: url });
        seenTools.add("aider");
      }
      if (!seenTools.has("vibe") && (msg.includes("vibe coded") || msg.includes("vibe-coded"))) {
        aiTools.push({ name: "vibe", detected_via: "commits", evidence_url: url });
        seenTools.add("vibe");
      }
    }
  } catch (e) {
    console.warn(`Failed to fetch commits for ${fullName}:`, e);
  }
  
  return { aiTools, commits };
}

function analyzeCommitMessages(
  commits: Array<{ commit?: { message?: string } }>,
): CommitMessageSignals {
  let totalLength = 0;
  let emDashCount = 0;
  let enDashCount = 0;
  let aiMentionCount = 0;
  const aiMentions = [
    "cursor",
    "claude",
    "claude code",
    "copilot",
    "gemini",
    "windsurf",
    "aider",
    "vibe coded",
    "vibe-coded",
  ];

  for (const c of commits) {
    const msg = c.commit?.message ?? "";
    const lower = msg.toLowerCase();
    totalLength += msg.length;
    emDashCount += (msg.match(/—/g) || []).length;
    enDashCount += (msg.match(/–/g) || []).length;
    if (aiMentions.some((term) => lower.includes(term))) aiMentionCount++;
  }

  const sampleSize = commits.length;
  return {
    sampleSize,
    avgMessageLength: sampleSize > 0 ? Math.round(totalLength / sampleSize) : 0,
    emDashCount,
    enDashCount,
    aiMentionCount,
  };
}

async function analyzeCommitSizes(
  fullName: string,
  commits: Array<{ sha?: string }>,
): Promise<CommitSizeSignals> {
  const sample = commits
    .map((c) => c.sha)
    .filter((sha): sha is string => typeof sha === "string")
    .slice(0, 8);

  if (sample.length === 0) {
    return { sampledCommits: 0, avgChanges: 0, medianChanges: 0, largeCommitCount: 0 };
  }

  const totals: number[] = [];
  for (const sha of sample) {
    try {
      const commit = await github.getCommit(fullName, sha);
      const total = Number(commit?.stats?.total ?? 0);
      totals.push(Number.isFinite(total) ? total : 0);
    } catch {
      totals.push(0);
    }
  }

  const sampledCommits = totals.length;
  const sorted = [...totals].sort((a, b) => a - b);
  const sum = totals.reduce((acc, n) => acc + n, 0);
  const medianChanges = sampledCommits % 2 === 1
    ? sorted[Math.floor(sampledCommits / 2)]
    : Math.round((sorted[sampledCommits / 2 - 1] + sorted[sampledCommits / 2]) / 2);
  const largeCommitCount = totals.filter((n) => n >= 500).length;

  return {
    sampledCommits,
    avgChanges: Math.round(sum / sampledCommits),
    medianChanges,
    largeCommitCount,
  };
}

async function detectContributorSignals(fullName: string): Promise<ContributorSignals> {
  try {
    const contributors = await github.getContributors(fullName, 100);
    const logins = (Array.isArray(contributors) ? contributors : [])
      .map((c: { login?: string }) => c.login || "")
      .filter(Boolean);
    const matchedBots = logins.filter((login) => /claude(\-code)?\[bot\]/i.test(login));
    return {
      hasClaudeBotContributor: matchedBots.length > 0,
      matchedBots,
    };
  } catch {
    return {
      hasClaudeBotContributor: false,
      matchedBots: [],
    };
  }
}

export function calculateDetectionSummary(
  aiTools: DetectionEvidence[],
  commitMessageSignals: CommitMessageSignals,
  commitSizeSignals: CommitSizeSignals,
  contributorSignals: ContributorSignals,
): DetectionSummary {
  let score = 0;
  const reasons: string[] = [];
  const fileSignals = aiTools.filter((t) => t.detected_via === "file").length;
  const commitSignals = aiTools.filter((t) => t.detected_via === "commits").length;

  if (fileSignals > 0) {
    score += fileSignals * 4;
    reasons.push(`${fileSignals} file-based AI signal(s)`);
  }
  if (commitSignals > 0) {
    score += commitSignals * 2;
    reasons.push(`${commitSignals} commit-message AI signal(s)`);
  }
  if (contributorSignals.hasClaudeBotContributor) {
    score += 3;
    reasons.push("claude bot contributor detected");
  }
  if (commitMessageSignals.emDashCount > 0 || commitMessageSignals.enDashCount > 0) {
    score += 1;
    reasons.push("dash punctuation pattern present in commits");
  }
  if (commitMessageSignals.aiMentionCount >= 2) {
    score += 2;
    reasons.push("multiple AI mentions in commit messages");
  }
  if (commitSizeSignals.largeCommitCount > 0) {
    score += 1;
    reasons.push("large commits detected");
  }

  const level = score >= 9 ? "high" : score >= 5 ? "medium" : "low";
  return { score, level, reasons };
}

export function shouldCreateDiscoveryPr(
  summary: DetectionSummary,
  signals: {
    aiTools: DetectionEvidence[];
    contributorSignals: ContributorSignals;
    commitMessageSignals: CommitMessageSignals;
  },
): boolean {
  if (summary.score < VIBE_SCORE_PR_THRESHOLD) return false;
  const fileSignals = signals.aiTools.filter((t) => t.detected_via === "file").length;
  const hasCommitAiPattern = signals.commitMessageSignals.aiMentionCount >= 2;
  return fileSignals > 0 || hasCommitAiPattern || signals.contributorSignals.hasClaudeBotContributor;
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

const SAST_PATHS: Array<{ path: string; label: string }> = [
  { path: ".github/workflows/codeql.yml", label: "CodeQL" },
  { path: ".github/workflows/codeql-analysis.yml", label: "CodeQL" },
  { path: ".github/workflows/codeql.yaml", label: "CodeQL" },
  { path: ".semgrep.yml", label: "Semgrep" },
  { path: ".semgrepconfig", label: "Semgrep" },
  { path: "sonar-project.properties", label: "Sonar" },
  { path: ".sonarcloud.properties", label: "SonarCloud" },
  { path: ".gitleaks.toml", label: "Gitleaks" },
  { path: ".bandit", label: "Bandit" },
  { path: "bandit.yaml", label: "Bandit" },
];

const LINT_PATHS: Array<{ path: string; label: string }> = [
  { path: ".eslintrc", label: "ESLint" },
  { path: ".eslintrc.js", label: "ESLint" },
  { path: ".eslintrc.json", label: "ESLint" },
  { path: ".eslintrc.yml", label: "ESLint" },
  { path: ".eslintrc.yaml", label: "ESLint" },
  { path: "eslint.config.js", label: "ESLint" },
  { path: ".prettierrc", label: "Prettier" },
  { path: ".prettierrc.js", label: "Prettier" },
  { path: ".prettierrc.json", label: "Prettier" },
  { path: ".prettierrc.yml", label: "Prettier" },
  { path: ".ruff.toml", label: "Ruff" },
  { path: ".pylintrc", label: "Pylint" },
  { path: ".golangci.yml", label: "golangci-lint" },
  { path: ".golangci.yaml", label: "golangci-lint" },
  { path: "biome.json", label: "Biome" },
  { path: "biome.jsonc", label: "Biome" },
];

async function detectSAST(fullName: string): Promise<{ hasSAST: boolean; evidenceUrl?: string }> {
  const repoInfo = await github.getRepo(fullName).catch(() => null);
  const defaultBranch = typeof repoInfo?.default_branch === "string" && repoInfo.default_branch.length > 0
    ? repoInfo.default_branch
    : "main";

  for (const { path } of SAST_PATHS) {
    if (await github.hasPath(fullName, path)) {
      const mode = path.includes(".github/workflows") ? "blob" : "blob";
      return {
        hasSAST: true,
        evidenceUrl: `https://github.com/${fullName}/blob/${defaultBranch}/${path}`,
      };
    }
  }

  const workflows = await github.listDir(fullName, ".github/workflows");
  for (const w of workflows) {
    if (w.type === "file" && /codeql|semgrep|sonar|trivy|gitleaks|bandit/i.test(w.name)) {
      return {
        hasSAST: true,
        evidenceUrl: `https://github.com/${fullName}/blob/${defaultBranch}/.github/workflows/${w.name}`,
      };
    }
  }
  return { hasSAST: false };
}

async function detectLinting(fullName: string): Promise<{ hasLinting: boolean; evidenceUrl?: string }> {
  const repoInfo = await github.getRepo(fullName).catch(() => null);
  const defaultBranch = typeof repoInfo?.default_branch === "string" && repoInfo.default_branch.length > 0
    ? repoInfo.default_branch
    : "main";

  for (const { path } of LINT_PATHS) {
    if (await github.hasPath(fullName, path)) {
      return {
        hasLinting: true,
        evidenceUrl: `https://github.com/${fullName}/blob/${defaultBranch}/${path}`,
      };
    }
  }

  const workflows = await github.listDir(fullName, ".github/workflows");
  for (const w of workflows) {
    if (w.type === "file" && /lint|eslint|ruff|prettier|golangci|biome/i.test(w.name)) {
      return {
        hasLinting: true,
        evidenceUrl: `https://github.com/${fullName}/blob/${defaultBranch}/.github/workflows/${w.name}`,
      };
    }
  }
  return { hasLinting: false };
}

/**
 * Detects the project's package manager based on presence of specific lock files.
 * @param fullName The GitHub repository's full name (owner/repo).
 * @returns The detected package manager name or null if none found.
 */
async function detectPackageManager(fullName: string): Promise<{ name: string; detected_via: string; evidence_url: string } | null> {
  const mapping: Record<string, string> = {
    "pnpm-lock.yaml": "pnpm",
    "bun.lockb": "bun",
    "bun.lock": "bun",
    "yarn.lock": "yarn",
    "package-lock.json": "npm",
    "npm-shrinkwrap.json": "npm",
    "package.json": "npm",
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
    "build.gradle.kts": "gradle",
    "uv.lock": "uv",
    "poetry.lock": "poetry",
  };

  const repoInfo = await github.getRepo(fullName).catch(() => null);
  const defaultBranch = typeof repoInfo?.default_branch === "string" && repoInfo.default_branch.length > 0
    ? repoInfo.default_branch
    : "main";

  for (const [file, pm] of Object.entries(mapping)) {
    if (await github.hasPath(fullName, file)) {
      return {
        name: pm,
        detected_via: file,
        evidence_url: `https://github.com/${fullName}/blob/${defaultBranch}/${file}`,
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
  aiTools: DetectionEvidence[];
  emojis: number;
  packageManager: { name: string; detected_via: string; evidence_url: string } | null;
  commitMessageSignals: CommitMessageSignals;
  commitSizeSignals: CommitSizeSignals;
  contributorSignals: ContributorSignals;
  detectionSummary: DetectionSummary;
  hasSAST: boolean;
  hasLinting: boolean;
  sastEvidenceUrl?: string | null;
  lintEvidenceUrl?: string | null;
}> {
  const [aiResult, emojis, packageManager, sastResult, lintResult] = await Promise.all([
    hasCursorOrClaude(fullName),
    fetchEmojiCount(fullName),
    detectPackageManager(fullName),
    detectSAST(fullName),
    detectLinting(fullName),
  ]);
  const { aiTools, commits } = aiResult;
  const commitMessageSignals = analyzeCommitMessages(commits);
  const commitSizeSignals = await analyzeCommitSizes(fullName, commits);
  const contributorSignals = await detectContributorSignals(fullName);
  const detectionSummary = calculateDetectionSummary(
    aiTools,
    commitMessageSignals,
    commitSizeSignals,
    contributorSignals,
  );
  return {
    aiTools,
    emojis,
    packageManager,
    commitMessageSignals,
    commitSizeSignals,
    contributorSignals,
    detectionSummary,
    hasSAST: sastResult.hasSAST,
    hasLinting: lintResult.hasLinting,
    sastEvidenceUrl: sastResult.evidenceUrl ?? null,
    lintEvidenceUrl: lintResult.evidenceUrl ?? null,
  };
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
  const { aiTools, emojis } = await detect(fullName!);
  console.log("aiTools:", aiTools.map((tool) => tool.name).join(", ") || "none");
  console.log("emojis:", emojis);
}
