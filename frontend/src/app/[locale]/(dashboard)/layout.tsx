import { Suspense } from "react";
import { DashboardLayoutWrapper } from "@/src/components/layouts/dashboard/DashboardLayoutWrapper";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <DashboardLayoutWrapper>{children}</DashboardLayoutWrapper>
    </Suspense>
  );
}
