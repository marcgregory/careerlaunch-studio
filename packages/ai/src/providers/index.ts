import type { AIProvider } from "./types";

export type { AIProvider } from "./types";
export type { DimensionResult } from "./types";

const registry = new Map<string, AIProvider>();

let defaultProvider: string | undefined;

/**
 * Register an AI provider implementation.
 */
export function registerProvider(name: string, provider: AIProvider): void {
  registry.set(name, provider);
  if (!defaultProvider) {
    defaultProvider = name;
  }
}

/**
 * Get a registered provider by name, or the default if omitted.
 */
export function getProvider(name?: string): AIProvider {
  const key = name ?? defaultProvider;
  const provider = key ? registry.get(key) : undefined;
  if (!provider) {
    throw new Error(
      `AI provider "${key ?? "<none>"}" not registered. ` +
        "Call registerProvider() first.",
    );
  }
  return provider;
}

/**
 * Set the default provider name.
 */
export function setDefaultProvider(name: string): void {
  if (!registry.has(name)) {
    throw new Error(`Cannot set default: provider "${name}" is not registered.`);
  }
  defaultProvider = name;
}

/**
 * List all registered provider names.
 */
export function listProviders(): string[] {
  return Array.from(registry.keys());
}

/**
 * Remove all registered providers (useful in tests).
 */
export function clearProviders(): void {
  registry.clear();
  defaultProvider = undefined;
}
