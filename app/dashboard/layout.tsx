import { SimulationProvider } from './SimulationProvider';

// Keeps one SimulationProvider instance (and its tick loop) alive across every route
// nested under /dashboard, so navigating between /dashboard and /dashboard/simulation
// does not pause or reset the running simulation. Only leaving /dashboard/* entirely
// unmounts this layout and resets state — same as today's no-persistence behavior.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <SimulationProvider>{children}</SimulationProvider>;
}
