#!/usr/bin/env -S deno run -A

const file = Deno.args[0];
if (!file) {
  console.error("Usage: deno run -A scripts/import.ts <file>");
  Deno.exit(1);
}
const { add } = await import("./add.ts");
const text = await Deno.readTextFile(file);
let added = 0;
for (const line of text.split("\n")) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  try {
    if (await add(s)) added++;
  } catch {
    console.error("Skip:", s);
  }
}
console.log("Imported:", added);
