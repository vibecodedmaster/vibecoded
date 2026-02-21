import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    globalThis.fetch = () => Promise.resolve(new Response("[]"));
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    } as unknown as Storage;
  });

  it("renders title", async () => {
    render(<App />);
    expect(
      await screen.findByText("Open-source Vibe Coded projects")
    ).toBeDefined();
  });
});
