import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

/**
 * No marketing page: signed-in users go straight to the dashboard,
 * everyone else goes to login. (The proxy also enforces this.)
 */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? ROUTES.dashboard : ROUTES.login);
}
