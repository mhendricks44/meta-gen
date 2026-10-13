import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Member } from "@shared/schema";

type AppState = {
  member: Member | null;
  setMember: (m: Member | null) => void;
  joinOpen: boolean;
  openJoin: (reason?: string) => void;
  closeJoin: () => void;
  joinReason: string | null;
  theme: "light" | "dark";
  toggleTheme: () => void;
  curatorCode: string | null;
  setCuratorCode: (c: string | null) => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinReason, setJoinReason] = useState<string | null>(null);
  const [curatorCode, setCuratorCode] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <Ctx.Provider
      value={{
        member,
        setMember,
        joinOpen,
        joinReason,
        openJoin: (reason) => {
          setJoinReason(reason ?? null);
          setJoinOpen(true);
        },
        closeJoin: () => setJoinOpen(false),
        theme,
        toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
        curatorCode,
        setCuratorCode,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}
