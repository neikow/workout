"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchMe, type AuthUser } from "./auth-client";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export type AuthState =
  | { status: "loading"; user: null }
  | { status: "guest"; user: null }
  | { status: "authenticated"; user: AuthUser; sessionId: string };

export function useAuth(): AuthState {
  const q = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
  });
  if (q.isLoading) return { status: "loading", user: null };
  const data = q.data;
  if (!data?.user || !data.sessionId) return { status: "guest", user: null };
  return {
    status: "authenticated",
    user: data.user,
    sessionId: data.sessionId,
  };
}

export function useInvalidateAuth() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["auth"] });
}
