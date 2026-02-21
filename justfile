# Vibe Coded - static site

install:
    pnpm install

dev:
    cd src && pnpm run dev

build:
    deno run -A scripts/sync-data.ts
    deno run -A scripts/generate-feed.ts
    pnpm --filter vibecoded-web run build

test:
    cd src && pnpm run test
    deno test -A scripts/lib/github_test.ts scripts/lib/logic_test.ts

lint:
    cd src && pnpm run lint

format:
    cd src && pnpm run format

add project:
    deno run -A scripts/add.ts {{ project }}

update project:
    deno run -A scripts/add.ts {{ project }} --update

scan project:
    deno run -A scripts/scan.ts {{ project }}

scan-update project:
    deno run -A scripts/scan.ts {{ project }} --update

detect project:
    deno run -A scripts/detect.ts {{ project }}

add-import file:
    deno run -A scripts/import.ts {{ file }}

refresh-all:
    deno run -A scripts/update-all.ts

# Submit a repository for scanning and PR creation via GitHub Actions
pr repo_url:
    gh workflow run add-project.yml -f repo_url={{ repo_url }}
