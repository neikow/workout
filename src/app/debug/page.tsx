import { notFound } from "next/navigation";
import { DebugView } from "./DebugView";

export default function DebugPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="app-main">
      <DebugView />
    </main>
  );
}
