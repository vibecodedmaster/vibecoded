export interface VulnDetail {
  pkg: string;
  version: string;
  cve: string;
  severity: string;
  title: string;
  fixedVersion?: string;
  type: "vuln" | "secret";
}

export interface ContributorInfo {
  login: string;
  avatar_url: string;
  url: string;
  created_at?: string | null;
  followers?: number | null;
  following?: number | null;
}

export interface Project {
  full_name: string;
  url: string;
  description?: string | null;
  stars?: number;
  commits?: number | null;
  contributors?: number | null;
  forks?: number | null;
  open_issues?: number | null;
  license?: string | null;
  topics?: string[] | null;
  size?: number | null;
  default_branch?: string | null;
  contributorDetails?: ContributorInfo[] | null;
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
  proof_sources?: Array<{ label: string; url: string }> | null;
  emojis?: number;
  packageManager?: {
    name: string;
    detected_via: string;
    evidence_url?: string;
  } | null;
  owner?: {
    login: string;
    avatar_url: string;
    url: string;
    created_at?: string | null;
    followers?: number | null;
    following?: number | null;
    bio?: string | null;
    public_repos?: number | null;
    is_private?: boolean;
  } | null;
}
