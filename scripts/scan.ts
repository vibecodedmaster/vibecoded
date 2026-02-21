#!/usr/bin/env -S deno run -A

import { GITHUB_RE } from "./lib/config.ts";
import { github } from "./lib/github.ts";
import { VulnDetail, VulnDetailSchema } from "./lib/schemas.ts";
import { readAllShards, upsertProject, migrateFromLegacyIfNeeded } from "./lib/shard.ts";
import { syncData } from "./sync-data.ts";

interface TrivyResult {
  Target?: string;
  Vulnerabilities?: any[];
  Secrets?: any[];
}

interface TrivyReport {
  Results?: TrivyResult[];
}

/**
 * Parses a GitHub owner/repo string or URL into a simple owner/repo string.
 * @param input The GitHub URL or owner/repo string.
 * @returns The parsed owner/repo string, or null if invalid.
 */
function parse(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(GITHUB_RE);
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}

export function buildTargetUrl(
  fullName: string,
  ref: string,
  target: string | undefined,
): string | undefined {
  if (!target) return undefined;
  const normalized = target.replace(/^\.\/+/, "");
  if (!normalized || normalized.includes("://")) return undefined;
  return `https://github.com/${fullName}/blob/${ref}/${normalized}`;
}

export function extractVulnerabilityDetails(
  report: TrivyReport,
  fullName: string,
  scanRef: string,
): { summary: string[]; details: VulnDetail[] } {
  const seen = new Set<string>();
  const summary: string[] = [];
  const details: VulnDetail[] = [];

  for (const r of report.Results ?? []) {
    for (const v of r.Vulnerabilities ?? []) {
      const detail = VulnDetailSchema.parse({
        pkg: v.PkgName ?? "unknown",
        version: v.InstalledVersion ?? "",
        cve: v.VulnerabilityID ?? "",
        severity: v.Severity ?? "UNKNOWN",
        title: v.Title ?? "",
        fixedVersion: v.FixedVersion,
        type: "vuln",
        target: r.Target ?? "",
        targetUrl: buildTargetUrl(fullName, scanRef, r.Target),
        scannedRef: scanRef,
      });

      const key = `vuln:${detail.pkg}@${detail.version}:${detail.cve}`;
      if (seen.has(key)) continue;
      seen.add(key);

      summary.push(detail.cve ? `${detail.pkg}@${detail.version} (${detail.cve})` : `${detail.pkg}@${detail.version}`);
      details.push(detail);
    }

    for (const s of r.Secrets ?? []) {
      const secretTarget = s.Target ?? r.Target;
      const detail = VulnDetailSchema.parse({
        pkg: "repo",
        version: "",
        cve: s.RuleID ?? "secret",
        severity: s.Severity ?? "CRITICAL",
        title: s.Title ?? "Secret Found",
        type: "secret",
        target: secretTarget ?? "",
        targetUrl: buildTargetUrl(fullName, scanRef, secretTarget),
        scannedRef: scanRef,
      });

      const key = `secret:${detail.cve}:${detail.title}`;
      if (seen.has(key)) continue;
      seen.add(key);

      summary.push(`Secret: ${detail.title}`);
      details.push(detail);
    }
  }

  return { summary: summary.sort(), details };
}

/**
 * Scans a GitHub repository for vulnerabilities and secrets using Trivy.
 * @param fullName The GitHub repository's full name (owner/repo).
 * @returns An object containing a summary list of vulnerabilities and their details.
 */
export async function scan(fullName: string): Promise<{ summary: string[]; details: VulnDetail[] }> {
  const repoUrl = `https://github.com/${fullName}`;
  const repoMeta = await github.getRepo(fullName).catch(() => null);
  const defaultBranch = repoMeta?.default_branch || "main";
  const scanRef = await github
    .fetchWithRetry(`https://api.github.com/repos/${fullName}/branches/${defaultBranch}`)
    .then((res) => res.json())
    .then((branch: { commit?: { sha?: string } }) => branch.commit?.sha || defaultBranch)
    .catch(() => defaultBranch);
  
  // Use spawn to safely execute the command with arguments array.
  const command = new Deno.Command("trivy", {
    args: ["repo", "-f", "json", "--scanners", "vuln,secret", repoUrl],
    stdout: "piped",
    stderr: "piped",
  });
  
  const { code, stdout, stderr } = await command.output();
  const out = new TextDecoder().decode(stdout);
  const err = new TextDecoder().decode(stderr);
  
  if (code !== 0 && code !== 1) {
    throw new Error(`trivy failed (${code}): ${err || out}`);
  }
  
  let report: TrivyReport;
  try {
    report = JSON.parse(out);
  } catch {
    return { summary: [], details: [] };
  }

  return extractVulnerabilityDetails(report, fullName, scanRef);
}

async function updateProjectVulns(
  fullName: string,
  vulns: string[],
  vulnDetails?: VulnDetail[],
) {
  await migrateFromLegacyIfNeeded();
  const data = await readAllShards();
  const project = data.projects.find((p) => p.full_name === fullName);
  if (!project) return;
  project.vulnerableDependencies = vulns;
  if (vulnDetails && vulnDetails.length > 0) {
    project.vulnerabilities = vulnDetails;
  }
  project.lastUpdated = new Date().toISOString();
  await upsertProject(project);
  await syncData();
}

if (import.meta.main) {
  const input = Deno.args[0];
  const update = Deno.args.includes("--update");
  if (!input) {
    console.error("Usage: deno run -A scripts/scan.ts <owner/repo|url> [--update]");
    Deno.exit(1);
  }
  const fullName = parse(input);
  if (!fullName) {
    console.error("Invalid: expected owner/repo or GitHub URL");
    Deno.exit(1);
  }
  try {
    const { summary, details } = await scan(fullName!);
    if (summary.length === 0) {
      console.log("No vulnerabilities found");
    } else {
      console.log(`Found ${summary.length} vulnerable dependenc${summary.length === 1 ? "y" : "ies"}:`);
      for (const v of summary) console.log("  ", v);
    }
    if (update) {
      await updateProjectVulns(fullName!, summary, details);
      console.log("Updated projects.json");
    }
  } catch (e) {
    console.error(e);
    Deno.exit(1);
  }
}
