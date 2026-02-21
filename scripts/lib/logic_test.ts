import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calculateDetectionSummary,
  parse,
  shouldCreateDiscoveryPr,
  VIBE_SCORE_PR_THRESHOLD,
} from "../detect.ts";
import { ProjectSchema } from "./schemas.ts";

Deno.test("parse() correctly handles various GitHub URL formats", () => {
  assertEquals(parse("owner/repo"), "owner/repo");
  assertEquals(parse("https://github.com/owner/repo"), "owner/repo");
  assertEquals(parse("https://github.com/owner/repo.git"), "owner/repo");
  assertEquals(parse("http://github.com/owner/repo/"), "owner/repo");
  assertEquals(parse("  owner/repo  "), "owner/repo");
  assertEquals(parse("https://www.github.com/owner/repo?tab=readme"), "owner/repo");
});

Deno.test("parse() returns null for invalid inputs", () => {
  assertEquals(parse("not-a-repo"), null);
  assertEquals(parse("https://gitlab.com/owner/repo"), null);
  assertEquals(parse(""), null);
  assertEquals(parse("github.com/owner"), null);
});

Deno.test("detection summary scores high for strong vibe signals", () => {
  const summary = calculateDetectionSummary(
    [
      {
        name: "cursor",
        detected_via: "file",
        evidence_url: "https://github.com/acme/repo/blob/main/.cursorrules",
      },
      {
        name: "claude",
        detected_via: "commits",
        evidence_url: "https://github.com/acme/repo/commit/123",
      },
    ],
    {
      sampleSize: 20,
      avgMessageLength: 72,
      emDashCount: 4,
      enDashCount: 0,
      aiMentionCount: 3,
    },
    {
      sampledCommits: 8,
      avgChanges: 450,
      medianChanges: 420,
      largeCommitCount: 2,
    },
    {
      hasClaudeBotContributor: true,
      matchedBots: ["claude[bot]"],
    },
  );

  assertEquals(summary.level, "high");
  assertEquals(summary.score >= VIBE_SCORE_PR_THRESHOLD, true);
});

Deno.test("PR gating rejects weak punctuation-only signal", () => {
  const summary = calculateDetectionSummary(
    [],
    {
      sampleSize: 12,
      avgMessageLength: 45,
      emDashCount: 2,
      enDashCount: 1,
      aiMentionCount: 0,
    },
    {
      sampledCommits: 8,
      avgChanges: 90,
      medianChanges: 80,
      largeCommitCount: 0,
    },
    {
      hasClaudeBotContributor: false,
      matchedBots: [],
    },
  );

  const shouldCreate = shouldCreateDiscoveryPr(summary, {
    aiTools: [],
    contributorSignals: {
      hasClaudeBotContributor: false,
      matchedBots: [],
    },
    commitMessageSignals: {
      sampleSize: 12,
      avgMessageLength: 45,
      emDashCount: 2,
      enDashCount: 1,
      aiMentionCount: 0,
    },
  });

  assertEquals(shouldCreate, false);
});

Deno.test("PR gating accepts claude bot contributor signal at threshold", () => {
  const summary = {
    score: VIBE_SCORE_PR_THRESHOLD,
    level: "medium" as const,
    reasons: ["claude bot contributor detected"],
  };

  const shouldCreate = shouldCreateDiscoveryPr(summary, {
    aiTools: [],
    contributorSignals: {
      hasClaudeBotContributor: true,
      matchedBots: ["claude-code[bot]"],
    },
    commitMessageSignals: {
      sampleSize: 10,
      avgMessageLength: 50,
      emDashCount: 0,
      enDashCount: 0,
      aiMentionCount: 0,
    },
  });

  assertEquals(shouldCreate, true);
});

Deno.test("ProjectSchema accepts hasSAST and hasLinting with evidence URLs", () => {
  const project = {
    full_name: "owner/repo",
    url: "https://github.com/owner/repo",
    hasSAST: true,
    sastEvidenceUrl: "https://github.com/owner/repo/blob/main/.github/workflows/codeql.yml",
    hasLinting: true,
    lintEvidenceUrl: "https://github.com/owner/repo/blob/main/.eslintrc.json",
  };
  const parsed = ProjectSchema.parse(project);
  assertEquals(parsed.hasSAST, true);
  assertEquals(parsed.hasLinting, true);
  assertEquals(parsed.sastEvidenceUrl, "https://github.com/owner/repo/blob/main/.github/workflows/codeql.yml");
  assertEquals(parsed.lintEvidenceUrl, "https://github.com/owner/repo/blob/main/.eslintrc.json");
});
