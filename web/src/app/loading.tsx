import { FullPageLoader } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <FullPageLoader />
    </div>
  );
}
