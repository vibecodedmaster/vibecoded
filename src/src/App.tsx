import { useState, useEffect, useMemo } from "preact/hooks";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Rss,
  Github,
} from "lucide-preact";
import ThemeToggle from "./ThemeToggle";
import ProjectCard from "./ProjectCard";
import ProjectDetail from "./ProjectDetail";
import type { Project } from "./types";

const SOURCE_URL = "https://github.com/vibecodedmaster/vibecoded";
const SUBMIT_URL = `${SOURCE_URL}/issues/new`;
const REMOVE_PROJECT_URL = `${SOURCE_URL}/issues/new?labels=removal-request&title=Remove%20my%20project%20from%20Vibe%20Coded`;
const PAGE_SIZE = 20;

type SortKey = "stars" | "commits" | "age" | "vulns";

function searchProjects(projects: Project[], q: string): Project[] {
  if (!q.trim()) return projects;
  const lower = q.toLowerCase().trim();
  const terms = lower.split(/\s+/);
  return projects.filter((p) => {
    const aiToolsStr = (p.aiTools || [])
      .map((t) => (typeof t === "string" ? t : t.name))
      .join(" ");
    const pmStr = p.packageManager
      ? typeof p.packageManager === "string"
        ? p.packageManager
        : p.packageManager.name
      : "";
    const text =
      `${p.full_name} ${p.description || ""} ${aiToolsStr} ${pmStr} ${(p.vulnerableDependencies || []).join(" ")} ${p.emojis ?? ""}`.toLowerCase();
    return terms.every((t) => text.includes(t));
  });
}

function filterProjects(
  projects: Project[],
  filters: {
    language: string;
    archived: "all" | "yes" | "no";
    aiTool: string;
    hasTests: "all" | "yes" | "no";
  }
): Project[] {
  return projects.filter((p) => {
    if (filters.language && p.language !== filters.language) return false;
    if (filters.archived === "yes" && !p.is_archived) return false;
    if (filters.archived === "no" && p.is_archived) return false;
    if (
      filters.aiTool &&
      !(p.aiTools || []).some((t) =>
        typeof t === "string" ? t === filters.aiTool : t.name === filters.aiTool
      )
    )
      return false;
    if (filters.hasTests === "yes" && !p.hasTests) return false;
    if (filters.hasTests === "no" && p.hasTests) return false;
    return true;
  });
}

function sortProjects(projects: Project[], sort: SortKey): Project[] {
  const arr = [...projects];
  switch (sort) {
    case "stars":
      return arr.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
    case "commits":
      return arr.sort((a, b) => (b.commits ?? 0) - (a.commits ?? 0));
    case "age":
      return arr.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return da - db;
      });
    case "vulns":
      return arr.sort((a, b) => {
        const va = (a.vulnerableDependencies || []).length;
        const vb = (b.vulnerableDependencies || []).length;
        return va - vb;
      });
    default:
      return arr;
  }
}

function ProjectList({ projects }: { projects: Project[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>("stars");
  const [filters, setFilters] = useState({
    language: "",
    archived: "all" as "all" | "yes" | "no",
    aiTool: "",
    hasTests: "all" as "all" | "yes" | "no",
  });

  const searched = useMemo(
    () => searchProjects(projects, query),
    [projects, query]
  );
  const filtered = useMemo(
    () => filterProjects(searched, filters),
    [searched, filters]
  );
  const sorted = useMemo(() => sortProjects(filtered, sort), [filtered, sort]);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE) || 1;
  const pageClamped = Math.max(1, Math.min(page, totalPages));
  const pageProjects = sorted.slice(
    (pageClamped - 1) * PAGE_SIZE,
    pageClamped * PAGE_SIZE
  );

  const languages = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.language) set.add(p.language);
    });
    return Array.from(set).sort();
  }, [projects]);

  const aiTools = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      (p.aiTools || []).forEach((t) => {
        const name = typeof t === "string" ? t : t.name;
        set.add(name);
      });
    });
    return Array.from(set).sort();
  }, [projects]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(sorted, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vibecoded-projects.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportCsv = () => {
    const headers = [
      "full_name",
      "url",
      "description",
      "stars",
      "commits",
      "contributors",
      "language",
    ];
    const rows = sorted.map((p) =>
      headers
        .map((h) => {
          const v = (p as unknown as Record<string, unknown>)[h];
          const s = String(v ?? "");
          return s.includes(",") || s.includes('"')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vibecoded-projects.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main class="w-full min-w-0 overflow-x-hidden max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <h1 class="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-vibe-fg">
        Open-source Vibe Coded projects
      </h1>
      <div class="flex flex-wrap gap-3 mb-4 min-w-0">
        <div class="flex items-center gap-2">
          <button
            type="button"
            onClick={exportJson}
            class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-vibe-elevated border border-vibe-border hover:border-vibe-muted/60 transition text-sm text-vibe-muted"
          >
            <Download size={16} strokeWidth={2} />
            JSON
          </button>
          <button
            type="button"
            onClick={exportCsv}
            class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-vibe-elevated border border-vibe-border hover:border-vibe-muted/60 transition text-sm text-vibe-muted"
          >
            <Download size={16} strokeWidth={2} />
            CSV
          </button>
        </div>
      </div>
      <div class="relative mb-4 min-w-0 w-full">
        <Search
          size={20}
          strokeWidth={2}
          class="absolute left-3 top-1/2 -translate-y-1/2 text-vibe-muted pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onInput={(e) => {
            setQuery((e.target as HTMLInputElement).value);
            setPage(1);
          }}
          placeholder="Search projects..."
          class="w-full pl-10 pr-4 py-3 sm:py-3.5 rounded-xl bg-vibe-elevated border border-vibe-border text-vibe-fg placeholder-vibe-muted focus:outline-none focus:ring-2 focus:ring-vibe-accent/50 focus:border-vibe-accent/50 transition text-base"
          aria-label="Search projects"
        />
      </div>
      <div class="flex flex-wrap gap-3 mb-4 min-w-0">
        <select
          value={sort}
          onChange={(e) => {
            setSort((e.target as HTMLSelectElement).value as SortKey);
            setPage(1);
          }}
          class="min-w-0 max-w-full px-3 py-2 rounded-lg bg-vibe-elevated border border-vibe-border text-vibe-fg text-sm"
        >
          <option value="stars">Sort: Stars</option>
          <option value="commits">Sort: Commits</option>
          <option value="age">Sort: Age</option>
          <option value="vulns">Sort: Vulnerabilities</option>
        </select>
        <select
          value={filters.language}
          onChange={(e) => {
            setFilters((f) => ({
              ...f,
              language: (e.target as HTMLSelectElement).value,
            }));
            setPage(1);
          }}
          class="min-w-0 max-w-full px-3 py-2 rounded-lg bg-vibe-elevated border border-vibe-border text-vibe-fg text-sm"
        >
          <option value="">All languages</option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={filters.archived}
          onChange={(e) => {
            setFilters((f) => ({
              ...f,
              archived: (e.target as HTMLSelectElement).value as
                | "all"
                | "yes"
                | "no",
            }));
            setPage(1);
          }}
          class="min-w-0 max-w-full px-3 py-2 rounded-lg bg-vibe-elevated border border-vibe-border text-vibe-fg text-sm"
        >
          <option value="all">All (archived)</option>
          <option value="no">Active only</option>
          <option value="yes">Archived only</option>
        </select>
        <select
          value={filters.aiTool}
          onChange={(e) => {
            setFilters((f) => ({
              ...f,
              aiTool: (e.target as HTMLSelectElement).value,
            }));
            setPage(1);
          }}
          class="min-w-0 max-w-full px-3 py-2 rounded-lg bg-vibe-elevated border border-vibe-border text-vibe-fg text-sm"
        >
          <option value="">All AI tools</option>
          {aiTools.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={filters.hasTests}
          onChange={(e) => {
            setFilters((f) => ({
              ...f,
              hasTests: (e.target as HTMLSelectElement).value as
                | "all"
                | "yes"
                | "no",
            }));
            setPage(1);
          }}
          class="min-w-0 max-w-full px-3 py-2 rounded-lg bg-vibe-elevated border border-vibe-border text-vibe-fg text-sm"
        >
          <option value="all">All (tests)</option>
          <option value="yes">Has tests</option>
          <option value="no">No tests</option>
        </select>
      </div>
      {sorted.length === 0 ? (
        <p class="mt-8 text-vibe-muted">
          {query ||
          filters.language ||
          filters.archived !== "all" ||
          filters.aiTool ||
          filters.hasTests !== "all"
            ? "No projects match your filters."
            : "No projects yet."}
        </p>
      ) : (
        <>
          <p class="mt-4 text-sm text-vibe-muted">
            {sorted.length} project{sorted.length !== 1 ? "s" : ""} found
          </p>
          <ul class="mt-4 sm:mt-5 space-y-3 sm:space-y-4 min-w-0 w-full list-none pl-0">
            {pageProjects.map((p) => (
              <li key={p.full_name} class="w-full min-w-0 overflow-hidden">
                <ProjectCard project={p} />
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <nav
              class="flex items-center justify-center gap-2 sm:gap-3 mt-8 sm:mt-10"
              aria-label="Pagination"
            >
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageClamped <= 1}
                class="min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-xl bg-vibe-elevated border border-vibe-border text-vibe-fg disabled:opacity-40 disabled:cursor-not-allowed hover:border-vibe-muted/50 active:scale-[0.98] transition-all touch-manipulation flex items-center justify-center gap-1.5"
              >
                <span class="hidden sm:inline">Previous</span>
                <ChevronLeft size={20} strokeWidth={2} />
              </button>
              <span class="px-4 py-2.5 text-sm text-vibe-muted min-w-[100px] text-center">
                Page {pageClamped} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageClamped >= totalPages}
                class="min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-xl bg-vibe-elevated border border-vibe-border text-vibe-fg disabled:opacity-40 disabled:cursor-not-allowed hover:border-vibe-muted/50 active:scale-[0.98] transition-all touch-manipulation flex items-center justify-center gap-1.5"
              >
                <span class="hidden sm:inline">Next</span>
                <ChevronRight size={20} strokeWidth={2} />
              </button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}

function AppContent({ projects }: { projects: Project[] }) {
  const [route, setRoute] = useState(() => {
    const hash = window.location.hash.slice(1) || "/";
    const m = hash.match(/^\/project\/([^/]+)\/([^/]+)/);
    return m
      ? { type: "detail" as const, owner: m[1], repo: m[2] }
      : { type: "list" as const };
  });

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1) || "/";
      const m = hash.match(/^\/project\/([^/]+)\/([^/]+)/);
      setRoute(
        m ? { type: "detail", owner: m[1], repo: m[2] } : { type: "list" }
      );
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (route.type === "detail") {
    return (
      <ProjectDetail
        projects={projects}
        owner={route.owner}
        repo={route.repo}
      />
    );
  }
  return <ProjectList projects={projects} />;
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}data/projects.json`)
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : (data?.projects ?? []);
        setProjects(arr);
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div class="min-h-screen bg-vibe-bg text-vibe-fg flex flex-col w-full max-w-full overflow-x-hidden">
      <header class="sticky top-0 z-10 border-b border-vibe-border bg-vibe-elevated/95 backdrop-blur-sm supports-[backdrop-filter]:bg-vibe-elevated/80 w-full min-w-0">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3 sm:gap-4 min-w-0">
          <a
            href={import.meta.env.BASE_URL}
            class="text-lg sm:text-xl font-bold text-vibe-fg shrink-0 hover:opacity-80 transition"
          >
            Vibe Coded
          </a>
          <nav class="flex flex-wrap items-center gap-3 sm:gap-4 min-w-0">
            <a
              href={SUBMIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm text-vibe-muted hover:text-vibe-fg transition"
            >
              Submit
            </a>
            <a
              href={`${import.meta.env.BASE_URL}data/projects.json`}
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm text-vibe-muted hover:text-vibe-fg transition"
            >
              Data
            </a>
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="text-vibe-muted hover:text-vibe-fg transition flex items-center"
              aria-label="GitHub repository"
            >
              <Github size={20} strokeWidth={2} />
            </a>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      {loading ? (
        <main class="w-full min-w-0 overflow-x-hidden max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <p class="text-vibe-muted py-8">Loading...</p>
        </main>
      ) : (
        <AppContent projects={projects} />
      )}
      <footer class="border-t border-vibe-border bg-vibe-elevated mt-auto w-full min-w-0">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex flex-col items-center justify-between gap-3 text-center sm:text-left min-w-0">
          <p class="text-[10px] text-vibe-muted max-w-[380px] sm:max-w-none break-words">
            Vibe Coded is an independent public index and is not affiliated
            with, endorsed by, or sponsored by any listed project, maintainer,
            or AI vendor. No warranty. Data may be wrong. We list projects; we
            do not run them.{" "}
            <a
              href={`${import.meta.env.BASE_URL}policies.html`}
              target="_blank"
              rel="noopener noreferrer"
              class="underline hover:text-vibe-fg transition sm:whitespace-nowrap"
            >
              Policies & Disclaimer
            </a>
          </p>
          <div class="flex items-center gap-4">
            <a
              href={`${import.meta.env.BASE_URL}feed.xml`}
              target="_blank"
              rel="noopener noreferrer"
              class="text-vibe-muted hover:text-vibe-fg transition"
              aria-label="RSS feed"
            >
              <Rss size={16} strokeWidth={2} />
            </a>
          </div>
          <a
            href={REMOVE_PROJECT_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="text-[11px] text-red-500 hover:text-red-400 font-semibold underline underline-offset-2 transition"
          >
            Remove my project
          </a>
        </div>
      </footer>
    </div>
  );
}
