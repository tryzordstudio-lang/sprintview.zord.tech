"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLoadingScreen } from "@/components/app-loading-screen";
import { apiGet } from "@/lib/api";

export function AuthPageGuard({ children }) {
  const router = useRouter();
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        await apiGet("/users/me");
        if (!active) {
          return;
        }

        router.replace("/app");
        router.refresh();
      } catch (_error) {
        if (!active) {
          return;
        }

        setResolved(true);
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  if (!resolved) {
    return <AppLoadingScreen />;
  }

  return children;
}
