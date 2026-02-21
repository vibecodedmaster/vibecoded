import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import ProjectCard from "./ProjectCard";
import { Project } from "./types";

const mockProject: Project = {
  full_name: "owner/repo",
  url: "https://github.com/owner/repo",
  description: "A simple description",
  stars: 100,
  commits: 50,
  contributors: 5,
  created_at: "2024-01-01T00:00:00Z",
  lastUpdated: "2024-01-01T00:00:00Z",
  language: "TypeScript",
  is_archived: false,
};

describe("ProjectCard", () => {
  it("renders project information correctly", () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText("owner/repo")).toBeDefined();
    expect(screen.getByText("A simple description")).toBeDefined();
    expect(screen.getByText("TypeScript")).toBeDefined();
    expect(screen.getByText("100")).toBeDefined();
  });

  it("handles long descriptions without breaking layout", () => {
    const longProject = {
      ...mockProject,
      description: "A very long description ".repeat(20),
    };
    const { container } = render(<ProjectCard project={longProject} />);
    const description = container.querySelector("p");
    expect(description?.className).toContain("line-clamp-2");
  });

  it("handles many AI tools without breaking layout", () => {
    const multiToolProject = {
      ...mockProject,
      aiTools: ["cursor", "claude", "gpt-4", "copilot", "vibe", "deepseek", "llama"],
    };
    render(<ProjectCard project={multiToolProject} />);
    for (const tool of multiToolProject.aiTools) {
      expect(screen.getByText(tool)).toBeDefined();
    }
  });

  it("handles long repository names correctly", () => {
    const longRepoProject = {
      ...mockProject,
      full_name: "a-very-long-owner-name/a-very-long-repository-name-that-might-overflow-the-card-container",
    };
    const { container } = render(<ProjectCard project={longRepoProject} />);
    const nameSpan = container.querySelector("span.font-mono");
    expect(nameSpan?.className).toContain("break-words");
  });

  it("renders vulnerability badges correctly", () => {
    const vulnerableProject = {
      ...mockProject,
      vulnerableDependencies: ["pkg1@1.0.0", "pkg2@2.0.0"],
      vulnerabilities: [
        {
          pkg: "pkg1",
          version: "1.0.0",
          cve: "CVE-2024-1234",
          severity: "HIGH",
          title: "A vuln",
          type: "vuln" as const,
        }
      ],
    };
    render(<ProjectCard project={vulnerableProject} />);
    expect(screen.getByText("2 vulnerable")).toBeDefined();
  });
});
