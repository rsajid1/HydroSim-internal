import "@testing-library/jest-dom"

// jsdom has no ResizeObserver; Recharts' ResponsiveContainer requires one to mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
