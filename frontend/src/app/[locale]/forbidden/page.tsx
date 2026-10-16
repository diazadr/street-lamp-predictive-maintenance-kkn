"use client";

import { ErrorView } from "@/src/components/common/ErrorView";

export default function ForbiddenPage() {
  return <ErrorView statusCode={403} />;
}
