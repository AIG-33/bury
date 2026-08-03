import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { countAttention } from "@/lib/notifications/attention";

// Feeds the badge on the mobile tab bar («Ещё»): pending match proposals +
// fresh notifications. Cheap head-count queries under the caller's RLS.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  const count = await countAttention(supabase, user.id);
  return NextResponse.json({ count });
}
