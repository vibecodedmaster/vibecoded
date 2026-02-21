import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getShardKeyFor } from "./shard.ts";

Deno.test("getShardKeyFor routes by owner first character", () => {
  assertEquals(getShardKeyFor("acme/repo"), "a");
  assertEquals(getShardKeyFor("foo/bar"), "f");
  assertEquals(getShardKeyFor("Other/repo"), "o");
  assertEquals(getShardKeyFor("123/repo"), "1");
  assertEquals(getShardKeyFor("zorg/thing"), "z");
});

Deno.test("getShardKeyFor returns other for non-alphanumeric owner initial", () => {
  assertEquals(getShardKeyFor("-/repo"), "other");
  assertEquals(getShardKeyFor("_org/repo"), "other");
  assertEquals(getShardKeyFor(".hidden/repo"), "other");
});

Deno.test("getShardKeyFor handles empty owner", () => {
  assertEquals(getShardKeyFor("/repo"), "other");
});
