export type PostImage = {
  url: string;
  thumbnailUrl: string;
  width?: number;
  height?: number;
  alt?: string;
};

export type CircleType = "大圈" | "中圈" | "小圈";

export type ModelPost = {
  id: string;
  slug: string;
  modelNumber?: string;
  title: string;
  area: string;
  circle?: CircleType;
  features?: string[];
  intro: string;
  content: string;
  images: PostImage[];
  videoUrl?: string;
  views: number;
  likes: number;
  isPublished?: boolean;
  publishedAt: string;
};

export type NewPostInput = Pick<
  ModelPost,
  "title" | "area" | "intro" | "content" | "images" | "videoUrl"
> & {
  circle: CircleType;
  features: string[];
  initialViews: number;
  initialLikes: number;
};

export type TutorialContent = {
  title: string;
  content: string;
  images: PostImage[];
  isPublished: boolean;
  updatedAt: string;
};
