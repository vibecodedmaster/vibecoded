import { ProjectsDataSchema, ProjectSchema, type Project, type ProjectsData } from "./schemas.ts";

const SHARD_DIR = new URL("../../data/projects/", import.meta.url);
const LEGACY_PATH = new URL("../../data/projects.json", import.meta.url);

const SHARD_KEYS = "abcdefghijklmnopqrstuvwxyz0123456789".split("");

function getShardKey(fullName: string): string {
  const owner = fullName.split("/")[0]?.toLowerCase() ?? "";
  const first = owner[0] ?? "";
  if (/[a-z0-9]/.test(first)) return first;
  return "other";
}

function getShardPath(key: string): URL {
  return new URL(`${key}.json`, SHARD_DIR);
}

async function ensureShardDir(): Promise<void> {
  try {
    await Deno.mkdir(SHARD_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

export async function readAllShards(): Promise<ProjectsData> {
  await ensureShardDir();
  const allProjects: Project[] = [];
  for (const key of [...SHARD_KEYS, "other"]) {
    const path = getShardPath(key);
    try {
      const content = await Deno.readTextFile(path);
      const parsed = JSON.parse(content);
      const data = ProjectsDataSchema.parse(parsed);
      allProjects.push(...data.projects);
    } catch {
      // shard missing or invalid, skip
    }
  }
  allProjects.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return { schemaVersion: 1, projects: allProjects };
}

export async function migrateFromLegacyIfNeeded(): Promise<void> {
  await ensureShardDir();
  let hasShards = false;
  for (const key of [...SHARD_KEYS, "other"]) {
    try {
      await Deno.stat(getShardPath(key));
      hasShards = true;
      break;
    } catch {
      // no file
    }
  }
  if (hasShards) return;
  try {
    const legacyContent = await Deno.readTextFile(LEGACY_PATH);
    const data = ProjectsDataSchema.parse(JSON.parse(legacyContent));
    if (data.projects.length === 0) return;
    const byShard = new Map<string, Project[]>();
    for (const p of data.projects) {
      const key = getShardKey(p.full_name);
      const list = byShard.get(key) ?? [];
      list.push(p);
      byShard.set(key, list);
    }
    for (const [key, projects] of byShard) {
      projects.sort((a, b) => a.full_name.localeCompare(b.full_name));
      const path = getShardPath(key);
      await Deno.writeTextFile(
        path,
        JSON.stringify({ schemaVersion: 1, projects }, null, 2),
      );
    }
  } catch {
    // no legacy file or invalid
  }
}

export async function upsertProject(project: Project): Promise<void> {
  const parsed = ProjectSchema.parse(project);
  const key = getShardKey(parsed.full_name);
  await ensureShardDir();
  const path = getShardPath(key);
  let data: ProjectsData;
  try {
    const content = await Deno.readTextFile(path);
    data = ProjectsDataSchema.parse(JSON.parse(content));
  } catch {
    data = { schemaVersion: 1, projects: [] };
  }
  const idx = data.projects.findIndex((p) => p.full_name === parsed.full_name);
  if (idx >= 0) {
    data.projects[idx] = parsed;
  } else {
    data.projects.push(parsed);
  }
  data.projects.sort((a, b) => a.full_name.localeCompare(b.full_name));
  await Deno.writeTextFile(path, JSON.stringify(data, null, 2));
}

export async function removeProject(fullName: string): Promise<boolean> {
  const key = getShardKey(fullName);
  const path = getShardPath(key);
  try {
    const content = await Deno.readTextFile(path);
    const data = ProjectsDataSchema.parse(JSON.parse(content));
    const before = data.projects.length;
    data.projects = data.projects.filter((p) => p.full_name !== fullName);
    if (data.projects.length === before) return false;
    await Deno.writeTextFile(path, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

export function getShardKeyFor(fullName: string): string {
  return getShardKey(fullName);
}
