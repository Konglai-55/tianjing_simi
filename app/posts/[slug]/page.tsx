import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, EyeIcon, HeartIcon, LocationIcon } from "@/components/icons";
import { DetailHeader } from "@/components/detail-header";
import { DetailStats } from "@/components/detail-stats";
import { getPost, getPostContext } from "@/lib/posts";
import type { ModelPost } from "@/types/post";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return { title: post.title, description: post.intro };
}

export default async function PostDetailPage({ params }: Props) {
  const { slug } = await params;
  const context = await getPostContext(slug);
  if (!context) notFound();
  const { post, previous, next, recent } = context;

  return (
    <div className="detail-page">
      <DetailHeader title={post.title} />
      <main className="detail-main">
        <article className="detail-article">
          <div className="detail-kicker">
            <LocationIcon />{post.area}
            {post.circle && <><span />{post.circle}</>}
          </div>
          <h1>{post.title}</h1>
          {post.intro && <p className="detail-intro">{post.intro}</p>}
          {post.features && post.features.length > 0 && (
            <div className="detail-features">
              {post.features.map((feature) => <span key={feature}>{feature}</span>)}
            </div>
          )}
          <DetailStats slug={post.slug} views={post.views} likes={post.likes} />

          {post.content && (
            <div className="article-copy">
              {post.content.split("\n").filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
          )}

          <div className="detail-gallery">
            {post.images.map((image, index) => (
              <figure key={`${image.url}-${index}`}>
                {index === 0 && post.modelNumber && (
                  <span className="number-badge">编号.{post.modelNumber}</span>
                )}
                <img
                  src={image.url}
                  alt={image.alt || `${post.title} 图片 ${index + 1}`}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  decoding="async"
                />
              </figure>
            ))}
          </div>

          {post.videoUrl && (
            <div className="detail-video">
              <video controls playsInline preload="metadata" src={post.videoUrl} />
            </div>
          )}

        </article>

        {(previous || next) && (
          <nav className="post-neighbors" aria-label="上一篇和下一篇">
            {previous && <NeighborCard label="上一篇" post={previous} />}
            {next && <NeighborCard label="下一篇" post={next} />}
          </nav>
        )}

        {recent.length > 0 && (
          <section className="recent-section">
            <div className="section-heading">
              <div><span className="section-index">02</span><h2>近期文章</h2></div>
              <Link href="/">查看全部 <ArrowRightIcon /></Link>
            </div>
            <div className="recent-list">
              {recent.map((item) => (
                <Link href={`/posts/${item.slug}`} key={item.id} className="recent-card">
                  <img src={item.images[0]?.thumbnailUrl || item.images[0]?.url} alt={item.images[0]?.alt || item.title} loading="lazy" />
                  <div><span>{item.area}</span><h3>{item.title}</h3><p><HeartIcon />{item.likes}<EyeIcon />{item.views}</p></div>
                  <ArrowRightIcon className="recent-arrow" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function NeighborCard({ label, post }: { label: string; post: ModelPost }) {
  return (
    <Link href={`/posts/${post.slug}`}>
      <img src={post.images[0]?.thumbnailUrl || post.images[0]?.url} alt="" loading="lazy" />
      <div><span>{label}</span><strong>{post.title}</strong></div>
      <ArrowRightIcon />
    </Link>
  );
}
