import { readAllShards, migrateFromLegacyIfNeeded } from "./lib/shard.ts";
import { dirname, join, fromFileUrl } from "https://deno.land/std@0.224.0/path/mod.ts";

/**
 * Generates an RSS feed (feed.xml) for the registry from the latest projects.
 */
async function generateFeed() {
  const baseUrl = "https://vibecodedmaster.github.io/vibecoded/";
  const feedPath = new URL("../src/public/feed.xml", import.meta.url);
  
  try {
    await migrateFromLegacyIfNeeded();
    const data = await readAllShards();
    const projects = data.projects;
    
    const sorted = [...projects].sort((a, b) => {
      const da = a.lastUpdated || a.created_at || "";
      const db = b.lastUpdated || b.created_at || "";
      return new Date(db).getTime() - new Date(da).getTime();
    });
    
    const items = sorted.slice(0, 50).map((p) => {
      const date = p.lastUpdated || p.created_at || new Date().toISOString();
      const [owner, repo] = p.full_name.split("/");
      const safeLink = baseUrl + `#/project/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
      const desc = (p.description || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      
      return `  <item>
    <title><![CDATA[${(p.full_name || "").replace(/\]\]>/g, "]]]]><![CDATA[>")}]]></title>
    <link>${safeLink}</link>
    <guid isPermaLink="true">${safeLink}</guid>
    <description><![CDATA[${desc}]]></description>
    <pubDate>${new Date(date).toUTCString()}</pubDate>
  </item>`;
    }).join("\n");
    
    const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Vibe Coded - New Projects</title>
    <link>${baseUrl}</link>
    <description>Open-source registry of Vibe Coded projects</description>
    <atom:link href="${baseUrl}feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
    
    const pathStr = fromFileUrl(feedPath);
    await Deno.mkdir(dirname(pathStr), { recursive: true });
    await Deno.writeTextFile(pathStr, feed);
    console.log("Generated feed.xml at", pathStr);
  } catch (e) {
    console.error("Failed to generate feed:", e);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await generateFeed();
}
