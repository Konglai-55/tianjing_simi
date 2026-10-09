"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CIRCLE_TYPES, SITE_NAME } from "@/lib/constants";
import type { ContactSettings } from "@/lib/settings";
import type { ModelPost, TutorialContent } from "@/types/post";
import { ArrowRightIcon, CloseIcon, EyeIcon, HeartIcon, LocationIcon, SearchIcon } from "@/components/icons";

const PAGE_SIZE = 8;
const HOME_RETURN_STATE_KEY = "zhenzhao-home-return-state";

type HomeFeedInitialState = {
  query: string;
  area: string;
  circle: string;
  feature: string;
  page: number;
};

export function HomeFeed({
  posts,
  areas,
  contact,
  tutorial,
  initialState,
}: {
  posts: ModelPost[];
  areas: string[];
  contact: ContactSettings;
  tutorial: TutorialContent;
  initialState: HomeFeedInitialState;
}) {
  const router = useRouter();
  const featureOptions = useMemo(
    () => [...new Set(posts.flatMap((post) => post.features || []))].sort((a, b) => a.localeCompare(b, "zh-CN")),
    [posts],
  );
  const [contactOpen, setContactOpen] = useState(false);
  const [query, setQuery] = useState(initialState.query);
  const [queryDraft, setQueryDraft] = useState(initialState.query);
  const [area, setArea] = useState(areas.includes(initialState.area) ? initialState.area : "全部");
  const [circle, setCircle] = useState(CIRCLE_TYPES.some((item) => item === initialState.circle) ? initialState.circle : "全部");
  const [feature, setFeature] = useState(featureOptions.includes(initialState.feature) ? initialState.feature : "全部");
  const [currentPage, setCurrentPage] = useState(initialState.page);
  // 公告及流程是前台入口公告：每次进入都自动弹出，不受后台“隐藏”状态影响。
  const [tutorialOpen, setTutorialOpen] = useState(true);
  const feedRef = useRef<HTMLElement>(null);
  const tutorialOpenButtonRef = useRef<HTMLButtonElement>(null);
  const tutorialCloseRef = useRef<HTMLButtonElement>(null);
  const restoredScrollRef = useRef(false);

  useEffect(() => {
    if (restoredScrollRef.current) return;
    restoredScrollRef.current = true;
    try {
      const saved = sessionStorage.getItem(HOME_RETURN_STATE_KEY);
      if (!saved) return;
      sessionStorage.removeItem(HOME_RETURN_STATE_KEY);
      const state = JSON.parse(saved) as { url?: string; scrollY?: number };
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (state.url !== currentUrl || typeof state.scrollY !== "number") return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => window.scrollTo(0, state.scrollY || 0));
      });
    } catch {
      sessionStorage.removeItem(HOME_RETURN_STATE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!tutorialOpen) return;
    const previousOverflow = document.body.style.overflow;
    const opener = tutorialOpenButtonRef.current;
    document.body.style.overflow = "hidden";
    tutorialCloseRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setTutorialOpen(false);
      if (event.key === "Tab") {
        event.preventDefault();
        tutorialCloseRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [tutorialOpen]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    return posts.filter((post) => {
      const areaMatched = area === "全部" || post.area === area;
      const circleMatched = circle === "全部" || post.circle === circle;
      const featureMatched = feature === "全部" || post.features?.includes(feature);
      const keywordMatched =
        !keyword ||
        `${post.modelNumber || ""} ${post.title} ${post.intro} ${post.area} ${post.circle || ""} ${(post.features || []).join(" ")}`
          .toLocaleLowerCase("zh-CN")
          .includes(keyword);
      return areaMatched && circleMatched && featureMatched && keywordMatched;
    });
  }, [area, circle, feature, posts, query]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const visiblePage = Math.min(currentPage, Math.max(totalPages, 1));
  const pagePosts = filtered.slice(
    (visiblePage - 1) * PAGE_SIZE,
    visiblePage * PAGE_SIZE,
  );
  const paginationItems = getPaginationItems(visiblePage, totalPages);

  function replaceHomeUrl(updates: Partial<HomeFeedInitialState>) {
    const nextQuery = updates.query ?? query;
    const nextArea = updates.area ?? area;
    const nextCircle = updates.circle ?? circle;
    const nextFeature = updates.feature ?? feature;
    const nextPage = updates.page ?? visiblePage;
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (nextArea !== "全部") params.set("area", nextArea);
    if (nextCircle !== "全部") params.set("circle", nextCircle);
    if (nextFeature !== "全部") params.set("feature", nextFeature);
    if (nextPage > 1) params.set("page", String(nextPage));
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    router.replace(nextUrl, { scroll: false });
  }

  function changeArea(nextArea: string) {
    replaceHomeUrl({ area: nextArea, page: 1 });
    setArea(nextArea);
    setCurrentPage(1);
  }

  function clearFilters() {
    replaceHomeUrl({ query: "", area: "全部", circle: "全部", feature: "全部", page: 1 });
    setQuery("");
    setQueryDraft("");
    setArea("全部");
    setCircle("全部");
    setFeature("全部");
    setCurrentPage(1);
  }

  function goToPage(page: number) {
    replaceHomeUrl({ page });
    setCurrentPage(page);
    requestAnimationFrame(() => {
      feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function rememberFeedPosition() {
    try {
      sessionStorage.setItem(HOME_RETURN_STATE_KEY, JSON.stringify({
        url: `${window.location.pathname}${window.location.search}`,
        scrollY: window.scrollY,
      }));
    } catch {
      // 浏览器禁用会话存储时，URL 中的页码仍可恢复列表状态。
    }
  }

  return (
    <div className="site-shell">
      <div className="search-panel is-open">
        <form
          className="search-input-row"
          onSubmit={(event) => {
            event.preventDefault();
            const nextQuery = queryDraft.trim();
            replaceHomeUrl({ query: nextQuery, page: 1 });
            setQuery(nextQuery);
            setCurrentPage(1);
          }}
        >
          <strong className="search-brand">{SITE_NAME}</strong>
          <div className="search-input-box">
            <SearchIcon />
            <input
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="请输入名字或编号"
              aria-label="搜索名字或编号"
            />
          </div>
          <button className="search-submit" type="submit">搜索</button>
        </form>
        <div className="search-filter-grid">
          <label>
            <span className="sr-only">区域</span>
            <select value={area} onChange={(event) => changeArea(event.target.value)} aria-label="按区域筛选">
              {["全部", ...areas].map((item) => <option key={item} value={item}>{item === "全部" ? "区域" : item}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">圈型</span>
            <select
              value={circle}
              onChange={(event) => {
                const nextCircle = event.target.value;
                replaceHomeUrl({ circle: nextCircle, page: 1 });
                setCircle(nextCircle);
                setCurrentPage(1);
              }}
              aria-label="按圈型筛选"
            >
              <option value="全部">圈型</option>
              {CIRCLE_TYPES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">特点</span>
            <select
              value={feature}
              onChange={(event) => {
                const nextFeature = event.target.value;
                replaceHomeUrl({ feature: nextFeature, page: 1 });
                setFeature(nextFeature);
                setCurrentPage(1);
              }}
              aria-label="按特点筛选"
            >
              <option value="全部">特点</option>
              {featureOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <button className="search-clear" type="button" onClick={clearFilters}>清除</button>
        </div>
      </div>
      {tutorial.isPublished && (
      <section className="tutorial-entry" aria-label="公告及流程">
          <button ref={tutorialOpenButtonRef} type="button" onClick={() => setTutorialOpen(true)}>
            <strong className="tutorial-entry-title">{tutorial.title}</strong>
            <ArrowRightIcon />
          </button>
        </section>
      )}

      <main>
        <section ref={feedRef} className="feed-section" aria-labelledby="latest-title">
          <div className="section-heading">
            <div>
              <h2 id="latest-title">最新发布</h2>
            </div>
            <span className="result-count">
              {filtered.length} 条结果
            </span>
          </div>

          {filtered.length > 0 ? (
            <>
              <div className="post-grid">
                {pagePosts.map((post, index) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    priority={visiblePage === 1 && index < 4}
                    onNavigate={rememberFeedPosition}
                  />
                ))}
              </div>
              {totalPages > 1 && (
                <nav className="pagination" aria-label="帖子分页">
                  <button
                    type="button"
                    disabled={visiblePage === 1}
                    onClick={() => goToPage(visiblePage - 1)}
                    aria-label="上一页"
                  >
                    上一页
                  </button>
                  <div className="pagination-pages">
                    {paginationItems.map((item) =>
                      typeof item === "number" ? (
                        <button
                          key={item}
                          className={item === visiblePage ? "is-active" : ""}
                          type="button"
                          aria-current={item === visiblePage ? "page" : undefined}
                          onClick={() => goToPage(item)}
                        >
                          {item}
                        </button>
                      ) : (
                        <span key={item} aria-hidden="true">…</span>
                      ),
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={visiblePage === totalPages}
                    onClick={() => goToPage(visiblePage + 1)}
                    aria-label="下一页"
                  >
                    下一页
                  </button>
                </nav>
              )}
            </>
          ) : (
            <div className="empty-state">
              <span>没有找到匹配结果</span>
              <button
                type="button"
                onClick={clearFilters}
              >
                查看全部
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-copy">
            <strong>{contact.footerTitle || SITE_NAME}</strong>
            <span>{contact.footerSubtitle}</span>
          </div>
          <button className="contact-toggle" type="button" onClick={() => setContactOpen((open) => !open)}>
            {contactOpen ? "关闭" : contact.contactTitle || "联系方式"}
          </button>
        </div>
        {contactOpen && (
          <section className="contact-window" aria-label="联系方式">
            <header>
              <strong>{contact.contactTitle || "联系方式"}</strong>
              <button className="contact-close" type="button" onClick={() => setContactOpen(false)}>关闭</button>
            </header>
            {contact.contactBody && <p className="contact-body">{contact.contactBody}</p>}
            <div className="contact-lines">
              {contact.primaryValue && (
                <div className="contact-line"><span>{contact.primaryLabel || "联系"}</span><strong>{contact.primaryValue}</strong></div>
              )}
              {contact.secondaryValue && (
                <div className="contact-line"><span>{contact.secondaryLabel || "备注"}</span><strong>{contact.secondaryValue}</strong></div>
              )}
            </div>
          </section>
        )}
      </footer>

      {tutorialOpen && (
        <div className="tutorial-modal-layer">
          <button className="tutorial-modal-backdrop" type="button" onClick={() => setTutorialOpen(false)} aria-label="关闭公告及流程" />
          <section className="tutorial-modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
            <header>
              <div><span className="eyebrow">公告及流程</span><h2 id="tutorial-title">{tutorial.title}</h2></div>
              <button ref={tutorialCloseRef} type="button" onClick={() => setTutorialOpen(false)} aria-label="关闭公告及流程"><CloseIcon /></button>
            </header>
            <div className="tutorial-modal-content">
              {tutorial.content && (
                <div className="tutorial-copy">
                  {tutorial.content.split("\n").filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                </div>
              )}
              {tutorial.images.length > 0 && (
                <div className="tutorial-gallery">
                  {tutorial.images.map((image, index) => (
                    <img key={`${image.url}-${index}`} src={image.url} alt={image.alt || `${tutorial.title} 步骤图 ${index + 1}`} loading={index === 0 ? "eager" : "lazy"} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

    </div>
  );
}

function getPaginationItems(current: number, total: number) {
  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  if (current <= 2) return [1, 2, 3, "end-ellipsis", total] as const;
  if (current >= total - 1) {
    return [1, "start-ellipsis", total - 2, total - 1, total] as const;
  }
  return [
    1,
    "start-ellipsis",
    current,
    "end-ellipsis",
    total,
  ] as const;
}

function PostCard({
  post,
  priority,
  onNavigate,
}: {
  post: ModelPost;
  priority: boolean;
  onNavigate: () => void;
}) {
  const cover = post.images[0];
  return (
    <article className="post-card">
      <Link href={`/posts/${post.slug}`} className="card-image-wrap" onNavigate={onNavigate}>
        <img
          className="card-image"
          src={cover?.thumbnailUrl || cover?.url}
          alt={cover?.alt || post.title}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
        />
        {post.modelNumber && (
          <span className="number-badge">编号.{post.modelNumber}</span>
        )}
        {post.circle && <span className="circle-badge">{post.circle}</span>}
        <span className="area-badge"><LocationIcon />{post.area}</span>
      </Link>
      <div className="card-body">
        <Link href={`/posts/${post.slug}`} onNavigate={onNavigate}>
          <h3>{post.title}</h3>
          {post.intro && <p>{post.intro}</p>}
        </Link>
        <div className="card-meta">
          <span><HeartIcon />{formatCount(post.likes)}</span>
          <span><EyeIcon />{formatCount(post.views)}</span>
        </div>
      </div>
    </article>
  );
}

export function formatCount(value: number) {
  return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : value.toLocaleString("zh-CN");
}




