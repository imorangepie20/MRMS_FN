import { Suspense } from "react";

import { PgtLibrary } from "@/components/mrms/PgtLibrary";

export default function PgtPage() {
  return (
    <Suspense fallback={null}>
      <PgtLibrary />
    </Suspense>
  );
}
