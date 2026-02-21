import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { GITHUB_RE } from "./config.ts";

Deno.test("GITHUB_RE matches standard github URLs", () => {
  const urls = [
    "https://github.com/owner/repo",
    "http://github.com/owner/repo",
    "www.github.com/owner/repo",
    "github.com/owner/repo",
    "owner/repo",
    "https://github.com/owner/repo.git",
    "https://github.com/owner/repo/",
    "https://github.com/owner/repo?tab=readme-ov-file"
  ];

  for (const url of urls) {
    const match = url.match(GITHUB_RE);
    assertNotEquals(match, null, `Failed to match: ${url}`);
    assertEquals(match![1], "owner");
    assertEquals(match![2].replace(".git", ""), "repo");
  }
});

Deno.test("GITHUB_RE rejects invalid URLs", () => {
  const urls = [
    "https://gitlab.com/owner/repo",
    "owner",
    "github.com/owner",
    "https://github.com/",
  ];

  for (const url of urls) {
    const match = url.match(GITHUB_RE);
    assertEquals(match, null, `Should not match: ${url}`);
  }
});
