import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/chrome/AppShell";

export const dynamic = "force-dynamic";

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.profileId) redirect("/profiles");
  return <AppShell>{children}</AppShell>;
}
