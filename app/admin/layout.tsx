import type { Metadata } from "next";
import { AdminShell } from "./_lib/shell";
import "./admin-new.css";

export const metadata: Metadata = {
  title: "Build us Care 관리자",
  robots: {
    index: false,
    follow: false
  }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
