"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlbumIcon,
  ArrowRightIcon,
  BookIcon,
  ChevronLeftIcon,
  SearchIcon,
  SettingsIcon,
  UploadIcon,
} from "@/components/icons";
import { ImageCropper } from "@/components/image-cropper";
import { prepareImage, type CropSettings } from "@/lib/image-client";
import { CIRCLE_TYPES } from "@/lib/constants";
import type { AdminSafeSettings, ContactSettings } from "@/lib/settings";
import type { ModelPost, PostImage, TutorialContent } from "@/types/post";

type UploadTicket = { uploadUrl: string; publicUrl: string; cacheControl: string };
type EditorImage =
  | { id: string; kind: "existing"; image: PostImage }
  | {
      id: string;
      kind: "new";
      file: File;
      crop?: CropSettings;
      cropPreview?: Blob;
    };

export function AdminDashboard({
  initialLoggedIn,
  initialSettings,
  storageConfigured,
}: {
  initialLoggedIn: boolean;
  initialSettings: AdminSafeSettings;
  storageConfigured: boolean;
}) {
  const [loggedIn, setLoggedIn] = useState(initialLoggedIn);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoginError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) return setLoginError(data.error || "登录失败");
    setLoggedIn(true);
    setPassword("");
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setLoggedIn(false);
  }

  if (!loggedIn) {
    return (
      <main className="admin-login">
        <Link href="/" className="admin-back"><ChevronLeftIcon /> 返回网站</Link>
        <form onSubmit={login}>
          <span className="eyebrow">CONTENT STUDIO</span>
          <h1>内容管理</h1>
          <p>登录后可上传图片与视频，并发布新的模特帖子。</p>
          <label>
            <span>后台密码</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </label>
          {loginError && <div className="form-error">{loginError}</div>}
          <button className="primary-button" type="submit">进入后台 <ArrowRightIcon /></button>
          <small>首次使用请先在服务器环境变量中配置 ADMIN_PASSWORD。</small>
        </form>
      </main>
    );
  }

  return (
    <Publisher
      initialSettings={initialSettings}
      storageConfigured={storageConfigured}
      onLogout={logout}
    />
  );
}

function Publisher({
  initialSettings,
  storageConfigured,
  onLogout,
}: {
  initialSettings: AdminSafeSettings;
  storageConfigured: boolean;
  onLogout: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"publish" | "library" | "tutorial" | "settings">("publish");
  const [posts, setPosts] = useState<ModelPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [managementQuery, setManagementQuery] = useState("");
  const [managementStatus, setManagementStatus] = useState<"all" | "published" | "offline">("all");
  const [managementArea, setManagementArea] = useState("全部");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);
  const [areas, setAreas] = useState(initialSettings.areas);
  const [newArea, setNewArea] = useState("");
  const [areasBusy, setAreasBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [contactDraft, setContactDraft] = useState<ContactSettings>({
    footerTitle: initialSettings.footerTitle,
    footerSubtitle: initialSettings.footerSubtitle,
    contactTitle: initialSettings.contactTitle,
    contactBody: initialSettings.contactBody,
    primaryLabel: initialSettings.primaryLabel,
    primaryValue: initialSettings.primaryValue,
    secondaryLabel: initialSettings.secondaryLabel,
    secondaryValue: initialSettings.secondaryValue,
  });
  const [contactBusy, setContactBusy] = useState(false);
  const [frontendPasswordEnabled, setFrontendPasswordEnabled] = useState(initialSettings.frontendPasswordEnabled);
  const [frontendPasswordConfigured, setFrontendPasswordConfigured] = useState(initialSettings.frontendPasswordConfigured);
  const [frontendPassword, setFrontendPassword] = useState("");
  const [frontendPasswordConfirm, setFrontendPasswordConfirm] = useState("");
  const [frontendPasswordBusy, setFrontendPasswordBusy] = useState(false);
  const [editingPost, setEditingPost] = useState<ModelPost | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState(initialSettings.areas[0] || "");
  const [circle, setCircle] = useState<(typeof CIRCLE_TYPES)[number]>("中圈");
  const [features, setFeatures] = useState("");
  const [initialViews, setInitialViews] = useState("0");
  const [initialLikes, setInitialLikes] = useState("0");
  const [intro, setIntro] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<EditorImage[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [published, setPublished] = useState<ModelPost | null>(null);

  const previewUrls = useMemo(
    () => images.map((image) => image.kind === "existing"
      ? { ...image, url: image.image.thumbnailUrl || image.image.url, revokable: false }
      : { ...image, url: URL.createObjectURL(image.cropPreview || image.file), revokable: true }),
    [images],
  );
  const managedPosts = useMemo(() => {
    const keyword = managementQuery.trim().toLocaleLowerCase("zh-CN");
    return posts.filter((post) => {
      const keywordMatched = !keyword || `${post.modelNumber || ""} ${post.title} ${post.area} ${post.circle || ""} ${(post.features || []).join(" ")}`.toLocaleLowerCase("zh-CN").includes(keyword);
      const statusMatched = managementStatus === "all" || (managementStatus === "published" ? post.isPublished !== false : post.isPublished === false);
      const areaMatched = managementArea === "全部" || post.area === managementArea;
      return keywordMatched && statusMatched && areaMatched;
    });
  }, [managementArea, managementQuery, managementStatus, posts]);
  const managedSlugs = useMemo(() => managedPosts.map((post) => post.slug), [managedPosts]);
  const selectedManagedSlugs = useMemo(() => managedSlugs.filter((slug) => selectedSlugs.includes(slug)), [managedSlugs, selectedSlugs]);
  const allManagedSelected = managedSlugs.length > 0 && managedSlugs.every((slug) => selectedSlugs.includes(slug));
  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      counts.set(post.area, (counts.get(post.area) || 0) + 1);
    }
    return counts;
  }, [posts]);
  const postAreaOptions = useMemo(() => {
    const options = [...areas];
    if (area && !options.includes(area)) options.unshift(area);
    return options;
  }, [area, areas]);
  const activeTabTitle =
    activeTab === "publish"
      ? "发布"
      : activeTab === "library"
        ? "相册管理"
        : activeTab === "tutorial"
          ? "公告及流程编辑"
          : "设置";

  useEffect(() => {
    return () => previewUrls.forEach(({ url, revokable }) => {
      if (revokable) URL.revokeObjectURL(url);
    });
  }, [previewUrls]);

  useEffect(() => {
    fetch("/api/admin/posts")
      .then((response) => response.json())
      .then((data: { posts?: ModelPost[] }) => setPosts(data.posts || []))
      .catch(() => setError("现有帖子列表加载失败"))
      .finally(() => setPostsLoading(false));
  }, []);

  function clearForm() {
    setEditingPost(null);
    setTitle("");
    setArea(areas[0] || "");
    setCircle("中圈");
    setFeatures("");
    setInitialViews("0");
    setInitialLikes("0");
    setIntro("");
    setContent("");
    setImages([]);
    setCoverIndex(0);
    setVideo(null);
  }

  function beginEdit(post: ModelPost) {
    setActiveTab("publish");
    setEditingPost(post);
    setTitle(post.title);
    setArea(post.area);
    setCircle(post.circle || "中圈");
    setFeatures((post.features || []).join("，"));
    setInitialViews(String(post.views));
    setInitialLikes(String(post.likes));
    setIntro(post.intro);
    setContent(post.content);
    setImages(post.images.map((image, index) => ({
      id: `existing-${index}-${image.url}`,
      kind: "existing" as const,
      image,
    })));
    setCoverIndex(0);
    setVideo(null);
    setPublished(null);
    setStatus("");
    setError("");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  async function togglePublished(post: ModelPost) {
    const nextPublished = post.isPublished === false;
    setTogglingSlug(post.slug);
    setError("");
    setStatus("");
    try {
      const response = await fetch(
        `/api/admin/posts/${encodeURIComponent(post.slug)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublished: nextPublished }),
        },
      );
      const data = (await response.json()) as { post?: ModelPost; error?: string };
      if (!response.ok || !data.post) throw new Error(data.error || "状态修改失败");
      setPosts((current) => current.map((item) =>
        item.slug === data.post?.slug ? data.post : item,
      ));
      setStatus(nextPublished ? "帖子已上架" : "帖子已下架");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "状态修改失败");
    } finally {
      setTogglingSlug(null);
    }
  }

  async function removeSelectedPosts() {
    const slugs = selectedManagedSlugs;
    if (slugs.length === 0) return;
    if (!window.confirm(`确认删除选中的 ${slugs.length} 篇相册吗？此操作不可恢复。`)) return;
    setBulkDeleteBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/admin/posts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs }),
      });
      const data = (await response.json()) as { deleted?: number; error?: string; cleanupWarning?: string };
      if (!response.ok) throw new Error(data.error || "批量删除失败");
      setPosts((current) => current.filter((post) => !slugs.includes(post.slug)));
      setSelectedSlugs((current) => current.filter((slug) => !slugs.includes(slug)));
      if (editingPost && slugs.includes(editingPost.slug)) clearForm();
      setStatus(data.cleanupWarning || `已删除 ${data.deleted || slugs.length} 篇相册`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "批量删除失败");
    } finally {
      setBulkDeleteBusy(false);
    }
  }

  async function removePost(post: ModelPost) {
    if (!window.confirm(`确认删除“${post.title}”吗？此操作不可恢复。`)) return;
    setDeletingSlug(post.slug);
    setError("");
    try {
      const response = await fetch(`/api/admin/posts/${encodeURIComponent(post.slug)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as {
        error?: string;
        cleanupWarning?: string;
      };
      if (!response.ok) throw new Error(data.error || "删除失败");
      setPosts((current) => current.filter((item) => item.slug !== post.slug));
      if (editingPost?.slug === post.slug) clearForm();
      setStatus(data.cleanupWarning || "帖子已删除");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除失败");
    } finally {
      setDeletingSlug(null);
    }
  }

  async function saveAreaList(nextAreas: string[], successMessage: string) {
    setAreasBusy(true);
    setSettingsError("");
    setSettingsStatus("");
    try {
      const response = await fetch("/api/admin/settings/areas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areas: nextAreas }),
      });
      const data = (await response.json()) as { areas?: string[]; error?: string };
      if (!response.ok || !data.areas) {
        throw new Error(data.error || "区域保存失败");
      }
      setAreas(data.areas);
      setSettingsStatus(successMessage);
      return data.areas;
    } catch (reason) {
      setSettingsError(reason instanceof Error ? reason.message : "区域保存失败");
      return null;
    } finally {
      setAreasBusy(false);
    }
  }

  async function addArea(event: FormEvent) {
    event.preventDefault();
    const value = newArea.trim().replace(/\s+/g, " ");
    if (!value) return setSettingsError("请输入区域名称");
    if (areas.includes(value)) return setSettingsError("这个区域已经存在");

    const savedAreas = await saveAreaList([...areas, value], "区域已添加");
    if (!savedAreas) return;
    setNewArea("");
    if (!area) setArea(value);
  }

  async function removeArea(value: string) {
    const count = areaCounts.get(value) || 0;
    const message = count
      ? `“${value}”当前有 ${count} 篇帖子。删除区域不会删除帖子，但首页筛选不再显示该区域。确认删除？`
      : `确认删除“${value}”吗？`;
    if (!window.confirm(message)) return;

    const savedAreas = await saveAreaList(
      areas.filter((item) => item !== value),
      "区域已删除",
    );
    if (savedAreas && !editingPost && area === value) {
      setArea(savedAreas[0] || "");
    }
  }

  function updateContactField(field: keyof ContactSettings, value: string) {
    setContactDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveContactSettings(event: FormEvent) {
    event.preventDefault();
    setContactBusy(true);
    setSettingsError("");
    setSettingsStatus("");
    try {
      const response = await fetch("/api/admin/settings/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactDraft),
      });
      const data = (await response.json()) as { contact?: ContactSettings; error?: string };
      if (!response.ok || !data.contact) {
        throw new Error(data.error || "联系方式保存失败");
      }
      setContactDraft(data.contact);
      setSettingsStatus("联系方式已保存");
    } catch (reason) {
      setSettingsError(reason instanceof Error ? reason.message : "联系方式保存失败");
    } finally {
      setContactBusy(false);
    }
  }

  async function saveFrontendPassword(event: FormEvent) {
    event.preventDefault();
    setFrontendPasswordBusy(true);
    setSettingsError("");
    setSettingsStatus("");
    if (frontendPassword !== frontendPasswordConfirm) {
      setSettingsError("两次输入的前台密码不一致");
      setFrontendPasswordBusy(false);
      return;
    }
    if (frontendPasswordEnabled && !frontendPasswordConfigured && !frontendPassword) {
      setSettingsError("开启前台密码前，请先设置密码");
      setFrontendPasswordBusy(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/settings/frontend-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: frontendPasswordEnabled,
          password: frontendPassword || undefined,
        }),
      });
      const data = (await response.json()) as {
        settings?: AdminSafeSettings;
        error?: string;
      };
      if (!response.ok || !data.settings) {
        throw new Error(data.error || "前台密码保存失败");
      }
      setFrontendPasswordEnabled(data.settings.frontendPasswordEnabled);
      setFrontendPasswordConfigured(data.settings.frontendPasswordConfigured);
      setFrontendPassword("");
      setFrontendPasswordConfirm("");
      setSettingsStatus(data.settings.frontendPasswordEnabled ? "前台密码已启用" : "前台密码已关闭");
    } catch (reason) {
      setSettingsError(reason instanceof Error ? reason.message : "前台密码保存失败");
    } finally {
      setFrontendPasswordBusy(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setSettingsError("");
    setSettingsStatus("");
    if (newPassword !== confirmPassword) {
      setSettingsError("两次输入的新密码不一致");
      return;
    }

    setPasswordBusy(true);
    try {
      const response = await fetch("/api/admin/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "密码修改失败");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSettingsStatus("后台密码已修改");
    } catch (reason) {
      setSettingsError(reason instanceof Error ? reason.message : "密码修改失败");
    } finally {
      setPasswordBusy(false);
    }
  }

  function chooseImages(files: FileList | null) {
    if (!files) return;
    const existing = new Set(
      images.flatMap((image) => image.kind === "new"
        ? [`${image.file.name}:${image.file.size}:${image.file.lastModified}`]
        : []),
    );
    const selected = Array.from(files).filter((file) => {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      return file.type.startsWith("image/") && !existing.has(key);
    });
    const next = [
      ...images,
      ...selected.map((file) => ({
        id: typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${file.name}-${file.lastModified}`,
        kind: "new" as const,
        file,
      })),
    ].slice(0, 20);
    setImages(next);
    setError(
      images.length + selected.length > 20 ? "图片最多上传 20 张" : "",
    );
  }

  function removeImage(index: number) {
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setCoverIndex((current) => {
      if (index === current) return 0;
      return index < current ? current - 1 : current;
    });
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!area.trim()) {
      setError("请先在设置里添加所在区域");
      return;
    }
    if (!storageConfigured && images.some((image) => image.kind === "new")) {
      setError("请先在 .env.local 中配置对象存储参数，再重启服务。");
      return;
    }
    if (images.length === 0) {
      setError("请至少选择一张图片");
      return;
    }

    setBusy(true);
    setError("");
    setPublished(null);
    try {
      const uploadedImages: PostImage[] = [];
      let videoUrl = editingPost?.videoUrl;
      const selectedCover = images[coverIndex] || images[0];
      const orderedImages = [
        selectedCover,
        ...images.filter((_, index) => index !== coverIndex),
      ];
      for (let index = 0; index < orderedImages.length; index += 1) {
        const selectedImage = orderedImages[index];
        if (selectedImage.kind === "existing") {
          uploadedImages.push(selectedImage.image);
        } else {
          const file = selectedImage.file;
          setStatus(`正在优化并上传第 ${index + 1}/${orderedImages.length} 张图片…`);
          const prepared = await prepareImage(file, selectedImage.crop);
          const [url, thumbnailUrl] = await Promise.all([
            uploadBlob(prepared.full, prepared.fullFileName, "image"),
            uploadBlob(prepared.thumb, `${file.name}.thumb.webp`, "thumb"),
          ]);
          uploadedImages.push({ url, thumbnailUrl, width: prepared.width, height: prepared.height, alt: title });
        }
      }

      if (video) {
        setStatus("正在直传视频…");
        videoUrl = await uploadBlob(video, video.name, "video");
      }

      setStatus(editingPost ? "正在保存修改…" : "正在发布帖子…");
      const response = await fetch(
        editingPost
          ? `/api/admin/posts/${encodeURIComponent(editingPost.slug)}`
          : "/api/admin/posts",
        {
        method: editingPost ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          area,
          circle,
          features: parseFeatures(features),
          initialViews: Number(initialViews),
          initialLikes: Number(initialLikes),
          intro,
          content,
          images: uploadedImages,
          videoUrl,
        }),
        },
      );
      const data = (await response.json()) as { post?: ModelPost; error?: string; cleanupWarning?: string };
      if (!response.ok || !data.post) throw new Error(data.error || "发布失败");
      const wasEditing = Boolean(editingPost);
      setPosts((current) =>
        wasEditing
          ? current.map((item) => (item.slug === data.post?.slug ? data.post : item))
          : [data.post as ModelPost, ...current],
      );
      setPublished(data.post);
      setStatus(data.cleanupWarning || (wasEditing ? "修改已保存" : "发布成功"));
      clearForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "发布失败，请稍后重试");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`admin-page tab-${activeTab}`}>
      <header className="admin-header">
        <Link href="/"><ChevronLeftIcon /> 返回网站</Link>
        <strong>真照联盟 · {activeTabTitle}</strong>
        <button type="button" onClick={onLogout}>退出</button>
      </header>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <section className="admin-guide">
            <span className="eyebrow">{editingPost ? "EDIT POST" : "NEW POST"}</span>
            <h1>{editingPost ? "编辑帖子" : "发布新帖子"}</h1>
            <p>
              {editingPost
                ? "修改文字与图片，可删除旧图、添加新图并重新指定封面。自动编号保持不变。"
                : "图片会在当前浏览器压缩为 WebP，再直接发送到对象存储。服务器不接收图片文件。"}
            </p>
            <ol><li>自动生成 1000–9999 不重复随机编号</li><li>裁剪只应用于封面，详情保留全图</li><li>删除帖子会同步清理媒体</li></ol>
            <div className={storageConfigured ? "storage-ok" : "storage-warn"}>
              <i />{storageConfigured ? "对象存储已配置" : "对象存储尚未配置"}
            </div>
          </section>

          <section className="post-manager">
            <div className="library-title">
              <div>
                <span className="eyebrow">ALBUM MANAGER</span>
                <h1>相册管理</h1>
              </div>
              <span>{posts.length} 篇</span>
            </div>
            <label className="library-search">
              <SearchIcon />
              <input value={managementQuery} onChange={(event) => setManagementQuery(event.target.value)} placeholder="搜索名字、编号、区域或特点" aria-label="搜索后台帖子" />
              {managementQuery && <button type="button" onClick={() => setManagementQuery("")}>清除</button>}
            </label>
            <div className="library-filters" aria-label="相册精准筛选">
              <select value={managementStatus} onChange={(event) => setManagementStatus(event.target.value as "all" | "published" | "offline")} aria-label="上架状态">
                <option value="all">全部状态</option><option value="published">已上架</option><option value="offline">已下架</option>
              </select>
              <select value={managementArea} onChange={(event) => setManagementArea(event.target.value)} aria-label="区域">
                <option value="全部">全部区域</option>
                {[...new Set([...areas, ...posts.map((post) => post.area)])].filter(Boolean).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <button className="bulk-delete-button" type="button" disabled={!selectedManagedSlugs.length || bulkDeleteBusy} onClick={removeSelectedPosts}>{bulkDeleteBusy ? "删除中…" : `删除所选${selectedManagedSlugs.length ? ` (${selectedManagedSlugs.length})` : ""}`}</button>
            </div>
            <div className="library-select-all">
              <label>
                <input type="checkbox" checked={allManagedSelected} onChange={(event) => {
                  setSelectedSlugs(event.target.checked
                    ? [...new Set([...selectedSlugs, ...managedSlugs])]
                    : selectedSlugs.filter((slug) => !managedSlugs.includes(slug)));
                }} />
                <span>勾选本页全部</span>
              </label>
              <span>{managedPosts.length} 篇结果</span>
            </div>
            {status && <div className="form-status">{status}</div>}
            {error && <div className="form-error">{error}</div>}
            {postsLoading ? (
              <p className="post-manager-empty">正在加载…</p>
            ) : managedPosts.length === 0 ? (
              <p className="post-manager-empty">{posts.length === 0 ? "暂无帖子" : "没有匹配的帖子"}</p>
            ) : (
              <div className="managed-post-list">
                {managedPosts.map((post) => (
                  <article
                    className={`${editingPost?.slug === post.slug ? "is-editing" : ""} ${post.isPublished === false ? "is-offline" : ""}`}
                    key={post.id}
                  >
                    <label className="managed-post-check"><input type="checkbox" checked={selectedSlugs.includes(post.slug)} onChange={(event) => setSelectedSlugs((current) => event.target.checked ? [...new Set([...current, post.slug])] : current.filter((slug) => slug !== post.slug))} aria-label={`选择${post.title}`} /></label>
                    <div className="managed-post-image">
                      <img
                        src={post.images[0]?.thumbnailUrl || post.images[0]?.url}
                        alt=""
                        loading="lazy"
                      />
                      <span>{post.isPublished === false ? "已下架" : "已上架"}</span>
                    </div>
                    <div className="managed-post-copy">
                      <span>{post.modelNumber ? `编号.${post.modelNumber}` : "自动编号"}</span>
                      <strong>{post.title}</strong>
                      <small>{post.area}{post.circle ? ` · ${post.circle}` : ""}</small>
                      <div>
                        <button
                          className={post.isPublished === false ? "publish-action" : "offline-action"}
                          type="button"
                          disabled={togglingSlug === post.slug}
                          onClick={() => togglePublished(post)}
                        >
                          {togglingSlug === post.slug
                            ? "处理中"
                            : post.isPublished === false ? "上架" : "下架"}
                        </button>
                        <button type="button" onClick={() => beginEdit(post)}>编辑</button>
                        <button
                          className="danger"
                          type="button"
                          disabled={deletingSlug === post.slug}
                          onClick={() => removePost(post)}
                        >
                          {deletingSlug === post.slug ? "删除中" : "删除"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>

        <form className="publisher-form" onSubmit={publish}>
          {editingPost && (
            <div className="editing-banner">
              <span>正在编辑：{editingPost.title}</span>
              <button
                type="button"
                onClick={() => {
                  clearForm();
                  setStatus("");
                  setError("");
                }}
              >
                取消编辑
              </button>
            </div>
          )}
          <div className="form-grid">
            <label className="field field-wide"><span>帖子标题</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="例如：林夕｜轻熟氛围感平面模特" required /></label>
            <div className="field"><span>帖子编号</span><div className="auto-number-field">{editingPost?.modelNumber ? `编号.${editingPost.modelNumber}` : "发布后自动生成"}</div></div>
            <label className="field">
              <span>所在区域</span>
              <select
                value={area}
                onChange={(event) => setArea(event.target.value)}
                disabled={postAreaOptions.length === 0}
                required
              >
                {postAreaOptions.length === 0 ? (
                  <option value="">请先添加区域</option>
                ) : (
                  postAreaOptions.map((item) => <option key={item}>{item}</option>)
                )}
              </select>
            </label>
            <label className="field"><span>圈型</span><select value={circle} onChange={(event) => setCircle(event.target.value as (typeof CIRCLE_TYPES)[number])}>{CIRCLE_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="field"><span>特点</span><input value={features} onChange={(event) => setFeatures(event.target.value)} maxLength={200} placeholder="例如：平面，轻熟，可商拍" /></label>
            <label className="field"><span>起始浏览量</span><input type="number" inputMode="numeric" min="0" max="999999999" step="1" value={initialViews} onChange={(event) => setInitialViews(event.target.value)} required /></label>
            <label className="field"><span>起始点赞量</span><input type="number" inputMode="numeric" min="0" max="999999999" step="1" value={initialLikes} onChange={(event) => setInitialLikes(event.target.value)} required /></label>
            <label className="field field-wide"><span>简短介绍（选填）</span><textarea value={intro} onChange={(event) => setIntro(event.target.value)} maxLength={300} rows={3} placeholder="用于首页卡片和详情页摘要，可不填写" /></label>
            <label className="field field-wide"><span>详细内容（选填）</span><textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={10000} rows={8} placeholder="介绍风格、经验、可接拍摄类型等；可不填写" /></label>
          </div>

          <section className="media-field">
            <div><strong>{editingPost ? "卡片图片" : "图片"}</strong><span>{editingPost ? "可换图、删图或重新设为封面" : "裁剪仅影响封面，详情保留全图"}</span></div>
            <label className="file-drop">
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={busy}
                onChange={(event) => {
                  chooseImages(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
              <b>＋</b><span>添加照片</span><small>支持单张添加或一次多选</small>
            </label>
            {previewUrls.length > 0 && (
              <div className="upload-previews">
                {previewUrls.map((image, index) => (
                  <div
                    className={index === coverIndex ? "is-cover" : ""}
                    key={image.id}
                  >
                    <button
                      className="preview-select"
                      type="button"
                      disabled={busy}
                      onClick={() => setCoverIndex(index)}
                      aria-label={`将第 ${index + 1} 张图片设为封面`}
                    >
                      <img src={image.url} alt={`${image.kind === "existing" ? "现有" : "待上传"}图片 ${index + 1}`} />
                      <span className="cover-label">
                        {index === coverIndex ? "当前封面" : "设为封面"}
                      </span>
                    </button>
                    {image.kind === "new" && (
                      <button
                        className="preview-crop"
                        type="button"
                        disabled={busy}
                        onClick={() => setCropTargetId(image.id)}
                      >
                        {image.crop ? "重新裁剪" : "裁剪"}
                      </button>
                    )}
                    <button
                      className="preview-remove"
                      type="button"
                      disabled={busy}
                      onClick={() => removeImage(index)}
                      aria-label={`删除第 ${index + 1} 张图片`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {editingPost?.videoUrl && <p className="retained-video-note">原视频会继续保留。</p>}
          </section>

          {!editingPost && <section className="media-field">
            <div><strong>视频（可选）</strong><span>推荐 MP4，不经过服务器中转</span></div>
            <label className="video-picker"><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => setVideo(event.target.files?.[0] || null)} /><span>{video ? video.name : "选择一个视频文件"}</span></label>
          </section>}

          {status && <div className="form-status">{status}</div>}
          {error && <div className="form-error">{error}</div>}
          {published && <div className="publish-success">已保存：<Link href={`/posts/${published.slug}`}>{published.title} <ArrowRightIcon /></Link></div>}
          <button className="publish-button" type="submit" disabled={busy}>
            {busy
              ? "正在处理，请勿关闭页面"
              : editingPost
                ? "保存修改"
                : "压缩、上传并发布"}
            <ArrowRightIcon />
          </button>
        </form>
        <TutorialEditor storageConfigured={storageConfigured} />
        <section className="settings-panel">
          <div className="settings-title">
            <div>
              <span className="eyebrow">SITE SETTINGS</span>
              <h1>后台设置</h1>
            </div>
            <span>{areas.length} 个区域</span>
          </div>

          {settingsStatus && <div className="form-status">{settingsStatus}</div>}
          {settingsError && <div className="form-error">{settingsError}</div>}

          <section className="settings-section">
            <div className="settings-section-head">
              <strong>所在区域</strong>
              <span>首页筛选和发布表单共用这份列表</span>
            </div>
            <form className="area-add-form" onSubmit={addArea}>
              <input
                value={newArea}
                onChange={(event) => setNewArea(event.target.value)}
                maxLength={20}
                placeholder="例如：武清区"
                disabled={areasBusy}
              />
              <button type="submit" disabled={areasBusy}>添加</button>
            </form>
            {areas.length === 0 ? (
              <p className="settings-empty">暂无区域</p>
            ) : (
              <div className="area-admin-list">
                {areas.map((item) => (
                  <div className="area-admin-row" key={item}>
                    <strong>{item}</strong>
                    <span>{areaCounts.get(item) || 0} 篇</span>
                    <button
                      type="button"
                      disabled={areasBusy}
                      onClick={() => removeArea(item)}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <strong>底部联系方式</strong>
              <span>首页底部按钮和弹窗内容</span>
            </div>
            <form className="contact-settings-form" onSubmit={saveContactSettings}>
              <div className="form-grid">
                <label className="field"><span>底部标题</span><input value={contactDraft.footerTitle} onChange={(event) => updateContactField("footerTitle", event.target.value)} maxLength={40} /></label>
                <label className="field"><span>底部副标题</span><input value={contactDraft.footerSubtitle} onChange={(event) => updateContactField("footerSubtitle", event.target.value)} maxLength={100} /></label>
                <label className="field"><span>窗口标题</span><input value={contactDraft.contactTitle} onChange={(event) => updateContactField("contactTitle", event.target.value)} maxLength={40} /></label>
                <label className="field field-wide"><span>窗口内容</span><textarea value={contactDraft.contactBody} onChange={(event) => updateContactField("contactBody", event.target.value)} maxLength={1000} rows={5} /></label>
                <label className="field"><span>主要联系标签</span><input value={contactDraft.primaryLabel} onChange={(event) => updateContactField("primaryLabel", event.target.value)} maxLength={20} /></label>
                <label className="field"><span>主要联系方式</span><input value={contactDraft.primaryValue} onChange={(event) => updateContactField("primaryValue", event.target.value)} maxLength={160} /></label>
                <label className="field"><span>补充标签</span><input value={contactDraft.secondaryLabel} onChange={(event) => updateContactField("secondaryLabel", event.target.value)} maxLength={20} /></label>
                <label className="field"><span>补充内容</span><input value={contactDraft.secondaryValue} onChange={(event) => updateContactField("secondaryValue", event.target.value)} maxLength={160} /></label>
              </div>
              <button className="settings-submit" type="submit" disabled={contactBusy}>
                {contactBusy ? "保存中" : "保存联系方式"}
              </button>
            </form>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <strong>前台访问密码</strong>
              <span>开启后进入首页和详情页都需要输入</span>
            </div>
            <form className="password-form" onSubmit={saveFrontendPassword}>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={frontendPasswordEnabled}
                  onChange={(event) => setFrontendPasswordEnabled(event.target.checked)}
                  disabled={frontendPasswordBusy}
                />
                <span>启用前台访问密码</span>
                <small>{frontendPasswordConfigured ? "已设置前台密码" : "尚未设置前台密码"}</small>
              </label>
              <label className="field">
                <span>前台密码</span>
                <input
                  type="password"
                  value={frontendPassword}
                  onChange={(event) => setFrontendPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={4}
                  maxLength={100}
                  placeholder={frontendPasswordConfigured ? "留空则不修改密码" : "请输入前台访问密码"}
                  disabled={frontendPasswordBusy}
                />
              </label>
              <label className="field">
                <span>确认前台密码</span>
                <input
                  type="password"
                  value={frontendPasswordConfirm}
                  onChange={(event) => setFrontendPasswordConfirm(event.target.value)}
                  autoComplete="new-password"
                  minLength={4}
                  maxLength={100}
                  placeholder={frontendPasswordConfigured ? "留空则不修改密码" : "再次输入前台访问密码"}
                  disabled={frontendPasswordBusy}
                />
              </label>
              <button className="settings-submit" type="submit" disabled={frontendPasswordBusy}>
                {frontendPasswordBusy ? "保存中" : "保存前台密码"}
              </button>
            </form>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <strong>后台密码</strong>
              <span>修改后当前登录状态会自动续期</span>
            </div>
            <form className="password-form" onSubmit={changePassword}>
              <label className="field">
                <span>当前密码</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={passwordBusy}
                  required
                />
              </label>
              <label className="field">
                <span>新密码</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={100}
                  disabled={passwordBusy}
                  required
                />
              </label>
              <label className="field">
                <span>确认新密码</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={100}
                  disabled={passwordBusy}
                  required
                />
              </label>
              <button className="settings-submit" type="submit" disabled={passwordBusy}>
                {passwordBusy ? "保存中" : "修改密码"}
              </button>
            </form>
          </section>
        </section>
      </div>
      {cropTargetId && (() => {
        const target = images.find((image) => image.id === cropTargetId);
        return target?.kind === "new" ? (
          <ImageCropper
            file={target.file}
            initialCrop={target.crop}
            onCancel={() => setCropTargetId(null)}
            onConfirm={(crop, cropPreview) => {
              setImages((current) => current.map((image) =>
                image.id === target.id ? { ...image, crop, cropPreview } : image,
              ));
              setCropTargetId(null);
            }}
          />
        ) : null;
      })()}
      <nav className="admin-bottom-nav" aria-label="后台功能导航">
        <button
          className={activeTab === "publish" ? "is-active" : ""}
          type="button"
          onClick={() => {
            setActiveTab("publish");
            setStatus("");
            setError("");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <UploadIcon />
          <span>发布</span>
        </button>
        <button
          className={activeTab === "library" ? "is-active" : ""}
          type="button"
          onClick={() => {
            setActiveTab("library");
            setStatus("");
            setError("");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <AlbumIcon />
          <span>相册管理</span>
        </button>
        <button
          className={activeTab === "tutorial" ? "is-active" : ""}
          type="button"
          onClick={() => {
            setActiveTab("tutorial");
            setStatus("");
            setError("");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <BookIcon />
          <span>公告及流程编辑</span>
        </button>
        <button
          className={activeTab === "settings" ? "is-active" : ""}
          type="button"
          onClick={() => {
            setActiveTab("settings");
            setStatus("");
            setError("");
            setSettingsStatus("");
            setSettingsError("");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <SettingsIcon />
          <span>设置</span>
        </button>
      </nav>
    </main>
  );
}

function TutorialEditor({ storageConfigured }: { storageConfigured: boolean }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [existingImages, setExistingImages] = useState<PostImage[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const newImagePreviews = useMemo(
    () => newImages.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [newImages],
  );

  useEffect(() => {
    return () => newImagePreviews.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [newImagePreviews]);

  useEffect(() => {
    fetch("/api/admin/tutorial")
      .then(async (response) => {
        const data = (await response.json()) as { tutorial?: TutorialContent; error?: string };
        if (!response.ok || !data.tutorial) throw new Error(data.error || "公告及流程加载失败");
        return data.tutorial;
      })
      .then((tutorial) => {
        setTitle(tutorial.title);
        setContent(tutorial.content);
        setIsPublished(tutorial.isPublished);
        setExistingImages(tutorial.images);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "公告及流程加载失败"))
      .finally(() => setLoading(false));
  }, []);

  function chooseTutorialImages(files: FileList | null) {
    if (!files) return;
    const existingKeys = new Set(newImages.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
    const selected = Array.from(files).filter((file) =>
      file.type.startsWith("image/") && !existingKeys.has(`${file.name}:${file.size}:${file.lastModified}`),
    );
    const available = Math.max(0, 12 - existingImages.length - newImages.length);
    setNewImages((current) => [...current, ...selected.slice(0, available)]);
    setError(selected.length > available ? "公告配图最多 12 张" : "");
  }

  async function saveTutorial(event: FormEvent) {
    event.preventDefault();
    if (newImages.length > 0 && !storageConfigured) {
      setError("请先配置对象存储后再上传公告配图");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const uploadedImages: PostImage[] = [...existingImages];
      for (let index = 0; index < newImages.length; index += 1) {
        const file = newImages[index];
        setStatus(`正在上传公告配图 ${index + 1}/${newImages.length}…`);
        const prepared = await prepareImage(file);
        const [url, thumbnailUrl] = await Promise.all([
          uploadBlob(prepared.full, prepared.fullFileName, "image"),
          uploadBlob(prepared.thumb, `${file.name}.thumb.webp`, "thumb"),
        ]);
        uploadedImages.push({
          url,
          thumbnailUrl,
          width: prepared.width,
          height: prepared.height,
          alt: `${title} 公告配图`,
        });
      }

      setStatus("正在保存公告及流程…");
      const response = await fetch("/api/admin/tutorial", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, images: uploadedImages, isPublished }),
      });
      const data = (await response.json()) as {
        tutorial?: TutorialContent;
        error?: string;
        cleanupWarning?: string;
      };
      if (!response.ok || !data.tutorial) throw new Error(data.error || "公告及流程保存失败");
      setExistingImages(data.tutorial.images);
      setNewImages([]);
      setStatus(data.cleanupWarning || "公告及流程已保存，前台已更新");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "公告及流程保存失败");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="tutorial-editor" onSubmit={saveTutorial}>
      <div className="tutorial-editor-heading">
        <div><span className="eyebrow">FRONT-END GUIDE</span><h1>公告及流程窗口</h1></div>
        <label className="publish-toggle">
          <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
          <span>{isPublished ? "前台显示入口" : "隐藏前台入口（仍会自动弹窗）"}</span>
        </label>
      </div>
      <p className="tutorial-editor-intro">公告及流程每次访问都会自动弹出；隐藏选项只隐藏首页入口卡片，不影响自动弹窗。</p>

      {loading ? <p className="tutorial-loading">正在加载教程…</p> : (
        <>
          <div className="form-grid tutorial-fields">
            <label className="field field-wide"><span>公告标题</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required /></label>
            <label className="field field-wide"><span>公告及流程内容</span><textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={10000} rows={10} placeholder="每次换行会在前台显示为一个新段落" /></label>
          </div>

          <section className="media-field">
            <div><strong>公告配图</strong><span>按当前顺序展示，最多 12 张</span></div>
            <label className="file-drop compact-drop">
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={busy}
                onChange={(event) => {
                  chooseTutorialImages(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
              <b>＋</b><span>添加公告配图</span><small>图片会自动压缩为 WebP</small>
            </label>
            {(existingImages.length > 0 || newImagePreviews.length > 0) && (
              <div className="tutorial-media-grid">
                {existingImages.map((image, index) => (
                  <div key={image.url}>
                    <img src={image.thumbnailUrl || image.url} alt={`现有公告配图 ${index + 1}`} />
                    <button type="button" disabled={busy} onClick={() => setExistingImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`删除现有公告配图 ${index + 1}`}>×</button>
                  </div>
                ))}
                {newImagePreviews.map(({ file, url }, index) => (
                  <div className="is-new" key={`${file.name}-${file.lastModified}`}>
                    <img src={url} alt={`待上传公告配图 ${index + 1}`} />
                    <span>待上传</span>
                    <button type="button" disabled={busy} onClick={() => setNewImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`删除待上传公告配图 ${index + 1}`}>×</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {status && <div className="form-status">{status}</div>}
          {error && <div className="form-error">{error}</div>}
          <button className="publish-button" type="submit" disabled={busy}>
            {busy ? "正在保存，请勿关闭页面" : "保存公告及流程"}<ArrowRightIcon />
          </button>
        </>
      )}
    </form>
  );
}

function parseFeatures(value: string) {
  return [...new Set(
    value
      .split(/[,，、\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
  )].slice(0, 10);
}

async function uploadBlob(blob: Blob, fileName: string, kind: "image" | "thumb" | "video") {
  const ticketResponse = await fetch("/api/admin/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, contentType: blob.type, kind }),
  });
  const ticket = (await ticketResponse.json()) as UploadTicket & { error?: string };
  if (!ticketResponse.ok) throw new Error(ticket.error || "无法获取上传许可");

  const uploadResponse = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": blob.type, "Cache-Control": ticket.cacheControl },
    body: blob,
  });
  if (!uploadResponse.ok) throw new Error(`对象存储上传失败（${uploadResponse.status}）`);
  return ticket.publicUrl;
}





