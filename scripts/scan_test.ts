import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildTargetUrl, extractVulnerabilityDetails } from "./scan.ts";

Deno.test("buildTargetUrl maps Trivy target to repo blob url", () => {
  const out = buildTargetUrl("acme/repo", "main", "package-lock.json");
  assertEquals(out, "https://github.com/acme/repo/blob/main/package-lock.json");
});

Deno.test("buildTargetUrl ignores external and empty targets", () => {
  assertEquals(buildTargetUrl("acme/repo", "main", ""), undefined);
  assertEquals(buildTargetUrl("acme/repo", "main", undefined), undefined);
  assertEquals(
    buildTargetUrl("acme/repo", "main", "https://example.com/lock.json"),
    undefined,
  );
});

Deno.test("extractVulnerabilityDetails attaches target and targetUrl", () => {
  const report = {
    Results: [
      {
        Target: "pnpm-lock.yaml",
        Vulnerabilities: [
          {
            PkgName: "lodash",
            InstalledVersion: "4.17.20",
            VulnerabilityID: "CVE-2021-23337",
            Severity: "HIGH",
            Title: "Command Injection",
            FixedVersion: "4.17.21",
          },
        ],
      },
    ],
  };

  const { summary, details } = extractVulnerabilityDetails(
    report,
    "acme/repo",
    "abcdef1234567890",
  );
  assertEquals(summary, ["lodash@4.17.20 (CVE-2021-23337)"]);
  assertEquals(details.length, 1);
  assertEquals(details[0].target, "pnpm-lock.yaml");
  assertEquals(
    details[0].targetUrl,
    "https://github.com/acme/repo/blob/abcdef1234567890/pnpm-lock.yaml",
  );
  assertEquals(details[0].scannedRef, "abcdef1234567890");
});

Deno.test("extractVulnerabilityDetails uses secret target fallback", () => {
  const report = {
    Results: [
      {
        Target: ".env",
        Secrets: [
          {
            RuleID: "aws-access-key-id",
            Severity: "CRITICAL",
            Title: "AWS Access Key ID",
          },
        ],
      },
    ],
  };

  const { details } = extractVulnerabilityDetails(
    report,
    "acme/repo",
    "deadbeefcafebabe",
  );
  assertEquals(details.length, 1);
  assertEquals(details[0].type, "secret");
  assertEquals(details[0].target, ".env");
  assertEquals(
    details[0].targetUrl,
    "https://github.com/acme/repo/blob/deadbeefcafebabe/.env",
  );
  assertEquals(details[0].scannedRef, "deadbeefcafebabe");
});
