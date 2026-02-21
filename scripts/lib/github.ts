import { GITHUB_API_BASE } from "./config.ts";

/**
 * Custom Error for GitHub API failures.
 */
export class GitHubError extends Error {
  constructor(public status: number, public body: string, message: string) {
    super(message);
    this.name = "GitHubError";
  }
}

/**
 * Handles communication with the GitHub API.
 */
export class GitHubClient {
  private token: string | undefined;

  constructor() {
    this.token = Deno.env.get("GITHUB_TOKEN");
  }

  /**
   * Returns standard headers for GitHub API requests.
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Vibe-Coded-Registry",
    };
    if (this.token) {
      headers.Authorization = `token ${this.token}`;
    }
    return headers;
  }

  /**
   * Performs a fetch with retry logic for rate limits.
   */
  async fetchWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      if (response.status === 403 || response.status === 429) {
        const rateLimitReset = response.headers.get("x-ratelimit-reset");
        if (rateLimitReset) {
          const resetTime = parseInt(rateLimitReset, 10) * 1000;
          const waitTime = Math.max(resetTime - Date.now(), 1000) + 1000; // Add 1s buffer
          
          if (waitTime < 60000) { // Only wait if less than a minute
            console.warn(`Rate limit hit, waiting ${waitTime}ms...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            attempt++;
            continue;
          }
        }
      }

      if (!response.ok) {
        const body = await response.text();
        throw new GitHubError(
          response.status,
          body,
          `GitHub API ${response.status}: ${body}`
        );
      }

      return response;
    }

    throw new Error("Max retries exceeded for GitHub API request.");
  }

  /**
   * Fetches repository information.
   */
  async getRepo(fullName: string) {
    const res = await this.fetchWithRetry(`${GITHUB_API_BASE}/repos/${fullName}`);
    return await res.json();
  }

  /**
   * Fetches user information.
   */
  async getUser(username: string) {
    const res = await this.fetchWithRetry(`${GITHUB_API_BASE}/users/${username}`);
    return await res.json();
  }

  /**
   * Fetches the count of items from a paginated API (e.g., commits, contributors).
   */
  async getCount(url: string): Promise<number | null> {
    const res = await fetch(`${url}?per_page=1`, { headers: this.getHeaders() });
    if (!res.ok) return null;
    
    const linkHeader = res.headers.get("Link");
    if (linkHeader) {
      const m = linkHeader.match(/<[^>]+[?&]page=(\d+)>[^>]*;\s*rel="last"/);
      if (m) return parseInt(m[1], 10);
    }
    
    const data = await res.json();
    return Array.isArray(data) ? data.length : null;
  }

  /**
   * Fetches languages used in a repository.
   */
  async getLanguages(fullName: string) {
    const res = await this.fetchWithRetry(`${GITHUB_API_BASE}/repos/${fullName}/languages`);
    return await res.json();
  }

  /**
   * Fetches contributors for a repository.
   */
  async getContributors(fullName: string, limit = 10) {
    const res = await this.fetchWithRetry(`${GITHUB_API_BASE}/repos/${fullName}/contributors?per_page=${limit}`);
    return await res.json();
  }

  /**
   * Checks if a file or directory exists in the repository.
   */
  async hasPath(fullName: string, path: string): Promise<boolean> {
    try {
      const res = await fetch(`${GITHUB_API_BASE}/repos/${fullName}/contents/${path}`, {
        headers: this.getHeaders(),
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Fetches recent commits to detect AI usage in messages.
   */
  async getRecentCommits(fullName: string, limit = 30) {
    const res = await this.fetchWithRetry(`${GITHUB_API_BASE}/repos/${fullName}/commits?per_page=${limit}`);
    return await res.json();
  }
}

export const github = new GitHubClient();
