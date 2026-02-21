import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parse } from "../detect.ts";

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
