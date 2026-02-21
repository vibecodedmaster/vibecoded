import {
  Github,
  GitCommit,
  Star,
  Users,
  GitFork,
  AlertCircle,
  Scale,
  HardDrive,
  Hash,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Box,
} from "lucide-preact";
import { LANG_COLORS } from "./langColors";
import type { Project } from "./types";

interface ProjectDetailProps {
  projects: Project[];
  owner?: string;
  repo?: string;
}

function formatAge(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const m = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
  const y = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365));
  if (d < 30) return `${d} day${d === 1 ? "" : "s"}`;
  if (m < 12) return `${m} month${m === 1 ? "" : "s"}`;
  return `${y} year${y === 1 ? "" : "s"}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default function ProjectDetail({
  projects,
  owner,
  repo,
}: ProjectDetailProps) {
  const fullName = owner && repo ? `${owner}/${repo}` : "";
  const project = projects.find((p) => p.full_name === fullName);

  if (!project) {
    return (
      <main class="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <p class="text-vibe-muted">Project not found: {fullName || "(none)"}</p>
        <a
          href={`${import.meta.env.BASE_URL}#/`}
          class="text-vibe-accent hover:underline mt-4 inline-block"
        >
          Back to list
        </a>
      </main>
    );
  }

  const langs =
    project.languages && Object.keys(project.languages).length > 0
      ? Object.entries(project.languages).sort(([, a], [, b]) => b - a)
      : project.language
        ? [[project.language, 1] as [string, number]]
        : [];

  const totalBytes = langs.reduce((acc, [, b]) => acc + b, 0);

  return (
    <main class="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <a
        href={`${import.meta.env.BASE_URL}#/`}
        class="text-sm text-vibe-muted hover:text-vibe-fg mb-2 inline-block transition"
      >
        Back to list
      </a>

      <div class="rounded-2xl bg-vibe-elevated border border-vibe-border overflow-hidden">
        {/* Header Header */}
        <div class="p-6 sm:p-8 border-b border-vibe-border">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="space-y-1">
              <h1 class="text-2xl sm:text-3xl font-bold font-mono text-vibe-fg break-all">
                {project.full_name}
              </h1>
              <p class="text-sm text-vibe-muted font-mono">{project.url}</p>
            </div>
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-vibe-accent text-vibe-bg font-semibold hover:opacity-90 transition shadow-lg shadow-vibe-accent/10"
            >
              <Github size={20} strokeWidth={2} />
              Open on GitHub
            </a>
          </div>
          {project.description && (
            <p class="mt-6 text-lg text-vibe-muted leading-relaxed max-w-3xl">
              {project.description}
            </p>
          )}

          <div class="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            <div class="p-3 rounded-xl bg-vibe-bg border border-vibe-border">
              <div class="text-xs text-vibe-muted flex items-center gap-1 mb-1">
                <Star size={12} /> Stars
              </div>
              <div class="font-mono font-bold text-vibe-fg">
                {project.stars ?? 0}
              </div>
            </div>
            <div class="p-3 rounded-xl bg-vibe-bg border border-vibe-border">
              <div class="text-xs text-vibe-muted flex items-center gap-1 mb-1">
                <GitCommit size={12} /> Commits
              </div>
              <div class="font-mono font-bold text-vibe-fg">
                {project.commits ?? 0}
              </div>
            </div>
            <div class="p-3 rounded-xl bg-vibe-bg border border-vibe-border">
              <div class="text-xs text-vibe-muted flex items-center gap-1 mb-1">
                <Users size={12} /> Contribs
              </div>
              <div class="font-mono font-bold text-vibe-fg">
                {project.contributors ?? 0}
              </div>
            </div>
            <div class="p-3 rounded-xl bg-vibe-bg border border-vibe-border">
              <div class="text-xs text-vibe-muted flex items-center gap-1 mb-1">
                <GitFork size={12} /> Forks
              </div>
              <div class="font-mono font-bold text-vibe-fg">
                {project.forks ?? 0}
              </div>
            </div>
            <div class="p-3 rounded-xl bg-vibe-bg border border-vibe-border">
              <div class="text-xs text-vibe-muted flex items-center gap-1 mb-1">
                <AlertCircle size={12} /> Issues
              </div>
              <div class="font-mono font-bold text-vibe-fg">
                {project.open_issues ?? 0}
              </div>
            </div>
            <div class="p-3 rounded-xl bg-vibe-bg border border-vibe-border">
              <div class="text-xs text-vibe-muted flex items-center gap-1 mb-1">
                <ShieldCheck size={12} /> Vulns
              </div>
              <div class="font-mono font-bold text-red-500">
                {project.vulnerableDependencies?.length ?? 0}
              </div>
            </div>
          </div>
        </div>

        <div class="p-6 sm:p-8 grid md:grid-cols-2 gap-8">
          {/* Left Column: Tech Stack & Detection */}
          <div class="space-y-8">
            <section>
              <h2 class="text-sm font-bold uppercase tracking-wider text-vibe-muted mb-4 flex items-center gap-2">
                <Box size={16} /> Tech Stack & Metadata
              </h2>
              <div class="space-y-4">
                <div class="flex flex-col gap-2">
                  <div class="h-2 w-full flex rounded-full overflow-hidden bg-vibe-bg border border-vibe-border">
                    {langs.map(([lang, bytes]) => (
                      <div
                        key={lang}
                        style={{
                          width: `${(bytes / totalBytes) * 100}%`,
                          backgroundColor: LANG_COLORS[lang] ?? "#6e7681",
                        }}
                        title={`${lang}: ${((bytes / totalBytes) * 100).toFixed(1)}%`}
                      />
                    ))}
                  </div>
                  <div class="flex flex-wrap gap-x-4 gap-y-2">
                    {langs.map(([lang, bytes]) => (
                      <div key={lang} class="flex items-center gap-1.5 text-xs">
                        <span
                          class="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: LANG_COLORS[lang] ?? "#6e7681",
                          }}
                        />
                        <span class="text-vibe-fg font-medium">{lang}</span>
                        <span class="text-vibe-muted">
                          {((bytes / totalBytes) * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div class="flex flex-wrap gap-2 text-xs">
                  {project.license && (
                    <span class="px-2.5 py-1 rounded-lg bg-vibe-bg border border-vibe-border text-vibe-fg flex items-center gap-1.5">
                      <Scale size={12} /> {project.license}
                    </span>
                  )}
                  {project.size != null && (
                    <span class="px-2.5 py-1 rounded-lg bg-vibe-bg border border-vibe-border text-vibe-fg flex items-center gap-1.5">
                      <HardDrive size={12} /> {(project.size / 1024).toFixed(1)}{" "}
                      MB
                    </span>
                  )}
                  {project.default_branch && (
                    <span class="px-2.5 py-1 rounded-lg bg-vibe-bg border border-vibe-border text-vibe-fg flex items-center gap-1.5">
                      <Hash size={12} /> {project.default_branch}
                    </span>
                  )}
                  {project.is_archived && (
                    <span class="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                      Archived
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section>
              <h2 class="text-sm font-bold uppercase tracking-wider text-vibe-muted mb-4 flex items-center gap-2">
                <Cpu size={16} /> Automated Detection
              </h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="p-4 rounded-xl bg-vibe-bg border border-vibe-border space-y-3">
                  <div class="text-xs font-semibold text-vibe-muted uppercase">
                    Package Manager
                  </div>
                  {project.packageManager ? (
                    <div class="flex items-center gap-3">
                      <a
                        href={project.packageManager.evidence_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 hover:bg-orange-500/20 transition flex items-center gap-1.5"
                        title={`Detected via ${project.packageManager.detected_via} (Click to verify)`}
                      >
                        {project.packageManager.name}
                        <ExternalLink size={12} />
                      </a>
                      <div class="text-[10px] text-vibe-muted leading-tight italic">
                        via {project.packageManager.detected_via}
                      </div>
                    </div>
                  ) : (
                    <div class="text-xs text-vibe-muted italic">
                      None detected
                    </div>
                  )}
                </div>
                <div class="p-4 rounded-xl bg-vibe-bg border border-vibe-border space-y-3">
                  <div class="text-xs font-semibold text-vibe-muted uppercase">
                    AI Tools Used
                  </div>
                  <div class="flex flex-wrap gap-2">
                    {project.aiTools && project.aiTools.length > 0 ? (
                      project.aiTools.map((t) => (
                        <div key={t.name} class="group relative">
                          <a
                            href={t.evidence_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 font-bold border border-violet-500/20 block hover:bg-violet-500/20 transition flex items-center gap-1.5 cursor-help"
                            title={`Detected via ${t.detected_via === "file" ? "config file" : "commits"} (Click to verify)`}
                          >
                            {t.name}
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      ))
                    ) : (
                      <div class="text-xs text-vibe-muted italic">
                        None detected
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {project.topics && project.topics.length > 0 && (
              <section>
                <h2 class="text-sm font-bold uppercase tracking-wider text-vibe-muted mb-3">
                  Topics
                </h2>
                <div class="flex flex-wrap gap-2">
                  {project.topics.map((t) => (
                    <span
                      key={t}
                      class="text-[10px] px-3 py-1 rounded-full bg-vibe-bg border border-vibe-border text-vibe-muted"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Column: Author & Contributors */}
          <div class="space-y-8">
            {project.owner && (
              <section>
                <h2 class="text-sm font-bold uppercase tracking-wider text-vibe-muted mb-4">
                  Author
                </h2>
                <div class="p-5 rounded-2xl bg-vibe-bg border border-vibe-border space-y-4">
                  <div class="flex items-center gap-4">
                    <a
                      href={project.owner.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="shrink-0"
                    >
                      <img
                        src={project.owner.avatar_url}
                        alt=""
                        class="w-16 h-16 rounded-full border-2 border-vibe-border hover:border-vibe-accent transition"
                        width={64}
                        height={64}
                      />
                    </a>
                    <div class="min-w-0">
                      <a
                        href={project.owner.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xl font-bold text-vibe-fg hover:text-vibe-accent transition truncate block"
                      >
                        {project.owner.login}
                      </a>
                      <div class="flex flex-wrap gap-x-4 text-[10px] text-vibe-muted">
                        {project.owner.created_at && (
                          <span>
                            Joined: {formatAge(project.owner.created_at)} ago
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {project.owner.is_private ? (
                    <div class="text-sm text-vibe-muted italic py-2 border-y border-vibe-border/50">
                      Profile Private
                    </div>
                  ) : (
                    <>
                      {project.owner.bio && (
                        <p class="text-sm text-vibe-muted leading-relaxed italic line-clamp-3">
                          "{project.owner.bio}"
                        </p>
                      )}

                      <div class="flex items-center gap-6 pt-2">
                        <div class="text-center">
                          <div class="text-xs font-bold text-vibe-fg">
                            {project.owner.followers ?? 0}
                          </div>
                          <div class="text-[10px] text-vibe-muted uppercase tracking-wider">
                            Followers
                          </div>
                        </div>
                        <div class="text-center">
                          <div class="text-xs font-bold text-vibe-fg">
                            {project.owner.following ?? 0}
                          </div>
                          <div class="text-[10px] text-vibe-muted uppercase tracking-wider">
                            Following
                          </div>
                        </div>
                        <div class="text-center">
                          <div class="text-xs font-bold text-vibe-fg">
                            {project.owner.public_repos ?? 0}
                          </div>
                          <div class="text-[10px] text-vibe-muted uppercase tracking-wider">
                            Repos
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}

            {project.contributorDetails &&
              project.contributorDetails.length > 0 && (
                <section>
                  <h2 class="text-sm font-bold uppercase tracking-wider text-vibe-muted mb-4">
                    Top Contributors
                  </h2>
                  <div class="grid grid-cols-2 gap-3">
                    {project.contributorDetails.slice(0, 10).map((c) => (
                      <a
                        key={c.login}
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="p-3 rounded-xl bg-vibe-bg border border-vibe-border flex items-center gap-3 hover:border-vibe-accent/50 transition group"
                      >
                        <img
                          src={c.avatar_url}
                          alt=""
                          class="w-8 h-8 rounded-full border border-vibe-border group-hover:opacity-80"
                          width={32}
                          height={32}
                        />
                        <div class="min-w-0">
                          <div class="text-xs font-bold text-vibe-fg truncate group-hover:text-vibe-accent transition">
                            {c.login}
                          </div>
                          {c.created_at && (
                            <div class="text-[10px] text-vibe-muted truncate">
                              {formatAge(c.created_at)}
                            </div>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                </section>
              )}

            {project.proof_sources && project.proof_sources.length > 0 && (
              <section>
                <h2 class="text-sm font-bold uppercase tracking-wider text-vibe-muted mb-4">
                  Proof & Sources
                </h2>
                <div class="space-y-2">
                  {project.proof_sources.map((s, i) => (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="flex items-center justify-between p-3 rounded-xl bg-vibe-bg border border-vibe-border hover:bg-vibe-accent/5 transition text-sm group"
                    >
                      <span class="text-vibe-fg font-medium">{s.label}</span>
                      <ExternalLink
                        size={14}
                        class="text-vibe-muted group-hover:text-vibe-accent transition"
                      />
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Security / Vulnerabilities Full Width Section */}
        {(project.vulnerableDependencies || []).length > 0 && (
          <div class="p-6 sm:p-8 bg-vibe-bg border-t border-vibe-border">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-lg font-bold text-vibe-fg flex items-center gap-2">
                <ShieldCheck class="text-red-500" />
                Security Audit Findings (
                {project.vulnerableDependencies!.length})
              </h2>
              <div class="text-xs text-vibe-muted italic flex flex-col items-end">
                <span>Scanned using Trivy</span>
                <span>Last updated: {formatDate(project.lastUpdated!)}</span>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-sm text-left border-collapse">
                <thead>
                  <tr class="text-vibe-muted border-b border-vibe-border">
                    <th class="pb-3 pr-4 font-semibold uppercase tracking-wider text-[10px]">
                      Severity
                    </th>
                    <th class="pb-3 pr-4 font-semibold uppercase tracking-wider text-[10px]">
                      Target
                    </th>
                    <th class="pb-3 pr-4 font-semibold uppercase tracking-wider text-[10px]">
                      Identifier
                    </th>
                    <th class="pb-3 font-semibold uppercase tracking-wider text-[10px]">
                      Description / Recommendation
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-vibe-border/50">
                  {project.vulnerabilities?.map((v, i) => (
                    <tr
                      key={i}
                      class="group hover:bg-vibe-elevated/50 transition-colors"
                    >
                      <td class="py-4 pr-4 align-top">
                        <span
                          class={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            v.severity === "CRITICAL"
                              ? "bg-red-500/20 text-red-600"
                              : v.severity === "HIGH"
                                ? "bg-orange-500/20 text-orange-600"
                                : v.severity === "MEDIUM"
                                  ? "bg-amber-500/20 text-amber-600"
                                  : "bg-blue-500/20 text-blue-600"
                          }`}
                        >
                          {v.severity}
                        </span>
                      </td>
                      <td class="py-4 pr-4 align-top font-mono text-xs text-vibe-fg">
                        {v.type === "secret"
                          ? "Repository"
                          : `${v.pkg}@${v.version}`}
                      </td>
                      <td class="py-4 pr-4 align-top">
                        <span class="font-mono text-xs text-vibe-muted group-hover:text-vibe-accent transition">
                          {v.cve}
                        </span>
                      </td>
                      <td class="py-4 align-top">
                        <div class="text-vibe-fg font-medium mb-1">
                          {v.type === "secret" && (
                            <span class="text-red-500 font-bold mr-1">
                              [SECRET]
                            </span>
                          )}
                          {v.title}
                        </div>
                        {v.fixedVersion && (
                          <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 inline-block px-1.5 py-0.5 rounded mt-1 border border-emerald-500/20">
                            Fixed in: {v.fixedVersion}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
