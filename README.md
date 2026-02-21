# Vibe Coded

Open-source registry of AI Vibe Coded projects for research and awareness.

## TODO

- Archiving sources.
- SAST/Linting detection.
- Generative AI policies.
- Better AI detection.

## Stack

- **Web**: Vite, Preact, Tailwind CSS
- **Data**: `./data/projects.json` (source of truth)

## Setup

```bash
just install
```

Or from project root: `pnpm install`

## Commands

| Command | Description |
|---------|-------------|
| `just dev` | Run dev server |
| `just build` | Build static site |
| `just add owner/repo` | Add one project locally |
| `just pr owner/repo` | Submit project via GitHub Action (creates a PR) |
| `just scan owner/repo` | Scan repo with Trivy (vulnerabilities and secrets) |
| `just scan-update owner/repo` | Scan and update security data in projects.json |
| `just detect owner/repo` | Detect cursor/Claude, package manager, and reactions |
| `just add-import file.txt` | Bulk import (one per line) |

## Self-Hosting

1. **Fork the repo**: Fork this repository
2. **Setup environment**:
   - Install `just` and `deno`.
   - Install `pnpm` (required for the frontend).
   - Install `trivy` (for security scanning).
3. **Configure GitHub Token**:
   - Create a Fine-grained Personal Access Token with read access to public repositories.
   - Set it as an environment variable: `export GITHUB_TOKEN=your_token_here`.
4. **Deploy**:
   - The project is designed to be hosted on **GitHub Pages** or **Vercel**.
   - For GitHub Pages, the `.github/workflows/deploy.yml` will handle it automatically on push.
   - Ensure the `BASE_URL` in your vite config or environment variables matches your hosting path.

### Docker

```bash
docker compose -f docker/compose.yml up -d
```

## Updating Data

### Local Updates
To manually refresh data for all projects:
```bash
deno run -A scripts/update-all.ts
```
This will update metadata (stars, commits), detect tools, and run security scans for every project in `data/projects.json`.

### Automated Updates
The repository includes a GitHub Action (`.github/workflows/daily-scan.yml`) that:
- Runs every 24 hours.
- Refreshes metadata for all projects.
- Performs fresh Trivy scans for vulnerabilities and secrets.
- Commits and pushes the updated data back to the repository.

### Adding New Projects
- Use `just add owner/repo` to add directly (requires write access).
- Use `just pr owner/repo` to trigger a GitHub Action that performs the scan and creates a PR for approval.

## Data format

`data/projects.json` is an array of:

```json
{
  "full_name": "owner/repo",
  "url": "https://github.com/owner/repo",
  "description": "optional",
  "owner": { 
    "login": "user", 
    "avatar_url": "...", 
    "url": "https://github.com/user", 
    "created_at": "2025-01-15T00:00:00Z",
    "followers": 100,
    "following": 50
  },
  "stars": 42,
  "commits": 150,
  "contributors": 5,
  "language": "TypeScript",
  "is_archived": false,
  "aiTools": ["cursor", "claude"],
  "packageManager": "npm",
  "hasTests": true,
  "vulnerableDependencies": ["pkg@1.0.0 (CVE-202X-XXXX)"],
  "vulnerabilities": [
    { "pkg": "pkg", "version": "1.0.0", "cve": "CVE-202X-XXXX", "severity": "HIGH", "type": "vuln" }
  ],
  "languages": { "TypeScript": 1000, "JavaScript": 500 },
  "emojis": 12,
  "lastUpdated": "2026-02-20T12:00:00Z"
}
```

## License

WTFPL v2. See [LICENSE](LICENSE).
