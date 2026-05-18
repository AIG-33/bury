import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSessionUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super("not_authenticated");
    this.name = "NotAuthenticatedError";
  }
}

/** Throws when the catalogue must not be read anonymously (server actions). */
export async function requireSessionUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new NotAuthenticatedError();
  return user;
}
