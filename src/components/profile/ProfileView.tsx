"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSyncedBundle } from "@/lib/use-synced-bundle";
import { AccountSection } from "./AccountSection";
import { StatsSection } from "./StatsSection";

export function ProfileView() {
  const synced = useSyncedBundle();

  return (
    <>
      <header
        className="editor-header"
        style={{
          background: "var(--color-header-bg)",
          borderBottom: "1px solid var(--color-border)",
          justifyContent: "flex-start",
          gap: "0.5rem",
        }}
      >
        <Link href="/" className="btn btn-icon" aria-label="Back to workouts">
          <ArrowLeft size={18} strokeWidth={1.75} aria-hidden />
        </Link>
        <h1>Profile</h1>
      </header>

      <div className="profile-body">
        {synced.status === "ready" ? (
          <StatsSection ydoc={synced.bundle.ydoc} />
        ) : (
          <section className="profile-section">
            <h2 className="profile-section-title">Statistics</h2>
            <p className="stats-muted">Loading your document…</p>
          </section>
        )}
        <AccountSection />
      </div>
    </>
  );
}
