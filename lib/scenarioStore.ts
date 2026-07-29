// Compare Scenarios (issue #10) — persistence behind a swappable interface.
//
// Phase 1 is localStorage-backed. Phase 2 can drop in a fetch-based implementation of the same
// ScenarioStore interface (a /api/scenarios router keyed by the Cognito user) with no UI rewrite.

import type { Scenario } from "@/lib/scenarioMetrics";

export interface ScenarioStore {
  /** All saved scenarios, newest first. */
  list(): Scenario[];
  /** Insert or replace (by id). */
  save(scenario: Scenario): void;
  remove(id: string): void;
  rename(id: string, label: string): void;
}

const STORAGE_KEY = "hydrosim.scenarios";

// SSR-safe and corruption-tolerant: every path no-ops when storage is unavailable (server render,
// storage disabled, quota exceeded) and treats unpariseable/legacy data as an empty list.
export class LocalStorageScenarioStore implements ScenarioStore {
  private read(): Scenario[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Scenario[]) : [];
    } catch {
      return [];
    }
  }

  private write(scenarios: Scenario[]): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
    } catch {
      /* quota / disabled storage — the in-memory UI state still holds this session */
    }
  }

  list(): Scenario[] {
    return this.read().sort((a, b) => b.createdAt - a.createdAt);
  }

  save(scenario: Scenario): void {
    const all = this.read().filter((s) => s.id !== scenario.id); // upsert by id
    all.push(scenario);
    this.write(all);
  }

  remove(id: string): void {
    this.write(this.read().filter((s) => s.id !== id));
  }

  rename(id: string, label: string): void {
    this.write(this.read().map((s) => (s.id === id ? { ...s, label } : s)));
  }
}

export const scenarioStore: ScenarioStore = new LocalStorageScenarioStore();