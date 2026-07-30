import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type DashboardGroup = {
  group_id: string;
  name: string;
  description: string | null;
  role: "owner" | "member";
  member_count: number;
  pending_count: number;
  completed_count: number;
  last_activity_event_type: string | null;
  last_activity_created_at: string | null;
};

export const getDashboardContext = cache(async () => {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) {
    return {
      user: null,
      profile: null,
      groups: [] as DashboardGroup[],
    };
  }

  const [{ data: profile }, { data: groups, error: groupsError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("name, email, avatar_url")
        .eq("id", user.id)
        .single(),
      supabase.rpc("get_dashboard_groups"),
    ]);

  if (groupsError) {
    throw new Error("Unable to load dashboard groups");
  }

  return {
    user,
    profile,
    groups: (groups ?? []) as DashboardGroup[],
  };
});
