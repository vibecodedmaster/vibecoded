import { Github, GitCommit, Star, Users } from "lucide-preact";
import { LANG_COLORS } from "./langColors";

interface Owner {
  login: string;
  avatar_url: string;
  url: string;
  created_at?: string | null;
  followers?: number | null;
  following?: number | null;
  bio?: string | null;
  public_repos?: number | null;
  is_private?: boolean;
}

interface VulnDetail {
  pkg: string;
  version: string;
  cve: string;
  severity: string;
  title: string;
  fixedVersion?: string;
  type: "vuln" | "secret";
}

interface Project {
  full_name: string;
  url: string;
  description?: string | null;
  stars?: number;
  commits?: number | null;
  contributors?: number | null;
  created_at?: string | null;
  lastUpdated?: string | null;
  language?: string | null;
  languages?: Record<string, number> | null;
  is_archived?: boolean;
  hasSAST?: boolean;
  aiTools?: Array<{
    name: string;
    detected_via: "file" | "commits";
    evidence_url?: string;
  }> | null;
  hasTests?: boolean;
  vulnerableDependencies?: string[];
  vulnerabilities?: VulnDetail[];
  emojis?: number;
  packageManager?: {
    name: string;
    detected_via: string;
    evidence_url?: string;
  } | null;
  owner?: Owner | null;
}

interface ProjectCardProps {
  project: Project;
}

function formatAge(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const m = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
  const y = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365));
  if (mins < 60) return `${Math.max(1, mins)} minute${mins === 1 ? "" : "s"}`;
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"}`;
  if (d < 30) return `${d} day${d === 1 ? "" : "s"}`;
  if (m < 12) return `${m} month${m === 1 ? "" : "s"}`;
  return `${y} year${y === 1 ? "" : "s"}`;
}

function LangBar({ languages }: { languages: Record<string, number> }) {
  const total = Object.values(languages).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const entries = Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);
  return (
    <div
      class="absolute top-0 left-0 w-1.5 sm:w-2 rounded-l-xl rounded-r-none h-full flex flex-col overflow-hidden z-20 pointer-events-auto"
      aria-hidden
    >
      {entries.map(([lang, bytes]) => {
        const pct = (bytes / total) * 100;
        return (
          <div
            key={lang}
            class="shrink-0"
            style={{
              backgroundColor: LANG_COLORS[lang] ?? "#6e7681",
              height: `${Math.max(pct, 2)}%`,
            }}
            title={`${lang}: ${pct.toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const hasMultiLang =
    project.languages && Object.keys(project.languages).length > 0;
  const singleLangColor =
    project.language && !hasMultiLang
      ? (LANG_COLORS[project.language] ?? "#6e7681")
      : null;

  const [owner, repo] = project.full_name.split("/");

  return (
    <div class="group relative block p-4 sm:p-5 rounded-xl bg-vibe-elevated border border-vibe-border hover:border-vibe-muted/60 transition-all touch-manipulation min-h-[160px] flex flex-col">
      <a
        href={`#/project/${owner}/${repo}`}
        class="absolute inset-0 z-[5] rounded-xl cursor-pointer"
        aria-label={`View details for ${project.full_name}`}
      />
      {hasMultiLang ? (
        <LangBar languages={project.languages!} />
      ) : singleLangColor ? (
        <div
          class="absolute top-0 left-0 w-1 sm:w-1.5 rounded-l-xl rounded-r-none h-full z-0"
          style={{ backgroundColor: singleLangColor }}
          title={`${project.language}: 100%`}
          aria-hidden
        />
      ) : null}
      <div
        class={`${hasMultiLang || singleLangColor ? "pl-4 sm:pl-5" : ""} relative z-0 flex-grow pointer-events-none`}
      >
        <div class="flex items-start justify-between gap-3 mb-2">
          <span class="font-mono font-semibold text-vibe-fg text-sm sm:text-base break-words group-hover:text-vibe-accent transition-colors">
            {project.full_name}
          </span>
          <span class="shrink-0 flex items-center gap-2 sm:gap-3 text-vibe-muted text-sm relative z-20 pointer-events-auto">
            {project.created_at && (
              <span
                class="text-[10px] bg-vibe-muted/10 px-1.5 py-0.5 rounded"
                title="Repository Age"
              >
                {formatAge(project.created_at)}
              </span>
            )}
            {project.commits != null && project.commits > 0 && (
              <span class="flex items-center gap-1" title="Commits">
                <GitCommit size={14} strokeWidth={2} />
                {project.commits >= 1000
                  ? `${(project.commits / 1000).toFixed(1)}k`
                  : project.commits}
              </span>
            )}
            {project.contributors != null && project.contributors > 0 && (
              <span class="flex items-center gap-1" title="Contributors">
                <Users size={14} strokeWidth={2} />
                {project.contributors}
              </span>
            )}
            {project.stars != null && project.stars > 0 && (
              <span class="flex items-center gap-1">
                <Star
                  size={14}
                  strokeWidth={2}
                  class="text-amber-500 dark:text-amber-400"
                />
                {project.stars}
              </span>
            )}
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label="Open on GitHub"
            >
              <Github
                size={14}
                strokeWidth={2}
                class="opacity-60 group-hover:opacity-100 transition"
              />
            </a>
          </span>
        </div>
        {project.description && (
          <p class="mt-2 text-sm text-vibe-muted line-clamp-2">
            {project.description}
          </p>
        )}
        <div class="mt-3 flex flex-wrap items-start justify-between gap-2">
          <div class="flex flex-col gap-2 pointer-events-auto relative z-20">
            <div class="flex flex-wrap gap-2 items-center">
              {project.language && !hasMultiLang && (
                <span class="text-xs px-2.5 py-1 rounded-lg bg-vibe-muted/20 text-vibe-fg">
                  {project.language}
                </span>
              )}
              {project.is_archived && (
                <span class="text-xs px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  Archived
                </span>
              )}
              {project.hasSAST && (
                <span class="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  SAST
                </span>
              )}
              {project.hasTests && (
                <span class="text-xs px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
                  Tests
                </span>
              )}
              {project.packageManager && (
                <span
                  class="text-xs px-2.5 py-1 rounded-lg bg-orange-500/20 text-orange-600 dark:text-orange-400 cursor-help relative z-20"
                  title={`Detected via ${project.packageManager.detected_via}`}
                >
                  {project.packageManager.name}
                </span>
              )}
              {(project.aiTools || []).map((t) => (
                <span
                  key={t.name}
                  class="text-xs px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-600 dark:text-violet-400 cursor-help relative z-20"
                  title={`Detected via ${t.detected_via === "file" ? "config file" : "commit messages"}`}
                >
                  {t.name}
                </span>
              ))}
              {(project.vulnerableDependencies || []).length > 0 && (
                <span class="relative group/vuln z-30 pointer-events-auto">
                  <span class="text-xs px-2.5 py-1 rounded-lg bg-red-500/20 text-red-600 dark:text-red-400 cursor-help">
                    {project.vulnerableDependencies!.length} vulnerable
                  </span>
                  {project.vulnerabilities &&
                    project.vulnerabilities.length > 0 && (
                      <div class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-40 hidden group-hover/vuln:block w-72 max-w-[calc(100vw-2rem)] opacity-0 group-hover/vuln:opacity-100 transition-opacity">
                        <div class="bg-vibe-elevated border border-vibe-border rounded-lg shadow-lg p-3 text-left">
                          <div class="flex items-center justify-between mb-2">
                            <p class="text-xs font-medium text-vibe-fg">
                              Vulnerabilities
                            </p>
                            <span class="text-[10px] text-vibe-muted italic">
                              Scanned using Trivy
                            </span>
                          </div>
                          <ul class="space-y-2 max-h-48 overflow-y-auto">
                            {project.vulnerabilities.map((v) => (
                              <li
                                key={`${v.pkg}-${v.cve}-${v.type}`}
                                class="text-xs"
                              >
                                {v.type === "secret" ? (
                                  <>
                                    <span class="font-bold text-red-600 dark:text-red-500">
                                      [SECRET]
                                    </span>
                                    <span class="text-vibe-fg ml-1">
                                      {v.title}
                                    </span>
                                    <span class="text-vibe-muted ml-1">
                                      ({v.cve})
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span class="font-mono text-vibe-fg">
                                      {v.pkg}@{v.version}
                                    </span>
                                    <span class="text-red-500 dark:text-red-400 ml-1">
                                      ({v.cve})
                                    </span>
                                  </>
                                )}
                                <span class="text-vibe-muted ml-1">
                                  {v.severity}
                                </span>
                                {v.title && v.type !== "secret" && (
                                  <p class="mt-0.5 text-vibe-muted line-clamp-2">
                                    {v.title}
                                  </p>
                                )}
                                {v.fixedVersion && (
                                  <p class="text-emerald-600 dark:text-emerald-400 text-[10px]">
                                    Fixed: {v.fixedVersion}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                </span>
              )}
              {project.emojis != null && project.emojis > 0 && (
                <span class="text-xs px-2.5 py-1 rounded-lg bg-vibe-muted/20 text-vibe-muted">
                  {project.emojis} reactions
                </span>
              )}
            </div>
            {project.lastUpdated && (
              <p class="text-[10px] text-vibe-muted">
                Updated:{" "}
                {new Date(project.lastUpdated).toLocaleDateString(undefined, {
                  dateStyle: "short",
                })}
                {project.license && ` • ${project.license}`}
              </p>
            )}
          </div>
          {project.owner && (
            <a
              href={project.owner.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              class="flex flex-col items-end gap-0.5 text-vibe-muted hover:text-vibe-fg transition shrink-0 relative z-20 pointer-events-auto"
              aria-label={`Author: ${project.owner.login}`}
            >
              <span class="flex items-center gap-2">
                <img
                  src={project.owner.avatar_url}
                  alt=""
                  class="w-7 h-7 rounded-full border border-vibe-border"
                  width={28}
                  height={28}
                  loading="lazy"
                />
                <span class="text-xs font-medium">{project.owner.login}</span>
              </span>
              {project.owner.created_at && (
                <span class="text-[10px] opacity-75">
                  Account Age: {formatAge(project.owner.created_at)}
                </span>
              )}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
