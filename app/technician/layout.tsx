import { TechnicianShell } from "./technician-shell";
import "./technician.css";

export default function TechnicianLayout({ children }: { children: React.ReactNode }) {
  return <TechnicianShell>{children}</TechnicianShell>;
}
