import { describe, it, expect, beforeEach } from "vitest";
import {
  registerProvider,
  getProvider,
  setDefaultProvider,
  listProviders,
  clearProviders,
} from "../../src/providers/index.js";
import { MockProvider } from "../../src/providers/mock.js";
import type { AIProvider } from "../../src/providers/types.js";

describe("provider registry", () => {
  beforeEach(() => {
    clearProviders();
  });

  it("registers and retrieves a provider", () => {
    registerProvider("mock", new MockProvider());
    const provider = getProvider("mock");
    expect(provider.name).toBe("Mock Analyzer");
  });

  it("returns the default provider when no name given", () => {
    registerProvider("mock", new MockProvider());
    const provider = getProvider();
    expect(provider.name).toBe("Mock Analyzer");
  });

  it("throws when no provider is registered", () => {
    expect(() => getProvider()).toThrow("AI provider");
  });

  it("throws when requesting an unregistered provider", () => {
    expect(() => getProvider("nonexistent")).toThrow();
  });

  it("allows setting a different default", () => {
    const mockA = new MockProvider();

    const mockB: AIProvider = {
      name: "Mock B",
      analyze: async () => ({ suggestions: [] }),
      healthCheck: async () => ({ available: true }),
    };

    registerProvider("mock-a", mockA);
    registerProvider("mock-b", mockB);
    setDefaultProvider("mock-b");
    expect(getProvider().name).toBe("Mock B");
  });

  it("lists registered providers", () => {
    registerProvider("a", new MockProvider());
    registerProvider("b", new MockProvider());
    const list = listProviders();
    expect(list).toContain("a");
    expect(list).toContain("b");
  });

  it("clears all providers", () => {
    registerProvider("mock", new MockProvider());
    clearProviders();
    expect(listProviders()).toHaveLength(0);
  });
});
