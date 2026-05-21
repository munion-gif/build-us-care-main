import { AdminShell } from "./admin-shell";
import "./admin.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
