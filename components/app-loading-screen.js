import { LoadingLogo } from "@/components/loading-logo";

export function AppLoadingScreen() {
  return (
    <main className="simple-loading-screen simple-loading-screen-full">
      <div className="brand-loading-stage">
        <LoadingLogo title="Loading workspace" />
        <div className="simple-loading-copy">
          <strong>SprintView</strong>
          <p>Loading workspace...</p>
        </div>
      </div>
    </main>
  );
}
