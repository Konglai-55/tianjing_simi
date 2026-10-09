"use client";

import { useEffect, useState } from "react";
import { EyeIcon, HeartIcon } from "@/components/icons";
import { formatCount } from "@/components/home-feed";

export function DetailStats({ slug, views, likes }: { slug: string; views: number; likes: number }) {
  const [viewCount, setViewCount] = useState(views);
  const [likeCount, setLikeCount] = useState(likes);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    const viewKey = `viewed:${slug}`;
    if (!sessionStorage.getItem(viewKey)) {
      sessionStorage.setItem(viewKey, "1");
      fetch(`/api/posts/${encodeURIComponent(slug)}/view`, { method: "POST" })
        .then((response) => response.json())
        .then((data: { views?: number }) => {
          if (typeof data.views === "number") setViewCount(data.views);
        })
        .catch(() => undefined);
    }
    const frame = requestAnimationFrame(() => {
      setLiked(localStorage.getItem(`liked:${slug}`) === "1");
    });
    return () => cancelAnimationFrame(frame);
  }, [slug]);

  async function like() {
    if (liked) return;
    setLiked(true);
    setLikeCount((value) => value + 1);
    localStorage.setItem(`liked:${slug}`, "1");
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(slug)}/like`, { method: "POST" });
      const data = (await response.json()) as { likes?: number };
      if (typeof data.likes === "number") setLikeCount(data.likes);
    } catch {
      // 点赞属于非关键交互，网络恢复后页面数据仍保持可用。
    }
  }

  return (
    <div className="detail-stats">
      <span><EyeIcon />{formatCount(viewCount)} 次阅读</span>
      <button className={liked ? "is-liked" : ""} type="button" onClick={like} aria-pressed={liked}>
        <HeartIcon />
        {liked ? "已喜欢" : "喜欢"} · {formatCount(likeCount)}
      </button>
    </div>
  );
}
