import { AppShell, PageHeader } from "@/components/chrome/AppShell";
import { SearchPane } from "@/components/search/SearchPane";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = typeof params?.q === "string" ? params.q : "";
  return (
    <AppShell>
      <PageHeader
        kicker="search"
        title="search"
        subtitle="across every conversation in your account"
      />
      <SearchPane initialQuery={q} />
    </AppShell>
  );
}
