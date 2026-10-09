import { SitePasswordGate } from "@/components/site-password-gate";
import { HomeFeed } from "@/components/home-feed";
import { SITE_NAME } from "@/lib/constants";
import { getPosts } from "@/lib/posts";
import { getSiteSettings, toContactSettings } from "@/lib/settings";
import { isSiteUnlocked } from "@/lib/site-auth";
import { getTutorial } from "@/lib/tutorial";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const settings = await getSiteSettings();
  const unlocked = await isSiteUnlocked(settings);
  if (!unlocked) return <SitePasswordGate siteName={SITE_NAME} />;

  const [posts, tutorial, params] = await Promise.all([
    getPosts(),
    getTutorial(),
    searchParams,
  ]);
  const requestedPage = Number.parseInt(firstParam(params.page), 10);
  return (
    <HomeFeed
      posts={posts}
      areas={settings.areas}
      contact={toContactSettings(settings)}
      tutorial={tutorial}
      initialState={{
        query: firstParam(params.q),
        area: firstParam(params.area),
        circle: firstParam(params.circle),
        feature: firstParam(params.feature),
        page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
      }}
    />
  );
}
