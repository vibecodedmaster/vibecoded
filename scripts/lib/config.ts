/**
 * Shared configuration and paths for the registry scripts.
 */
export const DATA_PATH = new URL("../../data/projects.json", import.meta.url);
export const PUBLIC_DATA_PATH = new URL("../../src/public/data/projects.json", import.meta.url);

export const GITHUB_API_BASE = "https://api.github.com";

export const GITHUB_RE =
  /^(?:(?:https?:\/\/)?(?:www\.)?github\.com\/)?([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/)?(?:\?.*)?$/;

export const MAX_CONCURRENCY = 5; // For parallelized updates
