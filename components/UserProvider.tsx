"use client";

import { Profile } from "@/types";
import { createClient } from "@/utils/supabase/client";
import { User, SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext, ReactNode, useMemo } from "react";

interface UserState {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isEditor: boolean;
  supabase: SupabaseClient;
}

const UserContext = createContext<UserState | undefined>(undefined);

export function UserProvider({
  children,
  user,
  profile,
}: {
  children: ReactNode;
  user: User | null;
  profile: Profile | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const isAdmin = profile?.role === "admin";
  const isEditor = profile?.role === "editor" || isAdmin;

  return (
    <UserContext.Provider value={{ user, profile, isAdmin, isEditor, supabase }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
