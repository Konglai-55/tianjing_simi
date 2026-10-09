# 真照联盟

面向手机端的天津本地模特推荐站。技术栈为 Next.js App Router + TypeScript，首页固定两列信息流，包含搜索、区域筛选、帖子详情、阅读/点赞、上一篇/下一篇、近期文章和内容发布后台。

## 为什么图片加载省服务器

- 后台在浏览器中把原图压缩为 WebP，同时生成 720px 缩略图和 1800px 详情图。
- 浏览器使用 5 分钟有效的预签名地址，直接把文件 PUT 到雨云 Rains3；图片和视频不经过 Next.js 服务器。
- 首页只请求缩略图，详情页才按需懒加载大图；对象设置一年强缓存。
- 前台使用对象存储原始 URL，不启用 Next.js 图片代理，因此不会消耗应用服务器 CPU 和出口流量。

## 本地运行

```bash
npm install
copy .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`，后台为 `http://localhost:3000/admin`。

## 环境变量

复制 `.env.example` 为 `.env.local`，设置强后台密码和新生成的对象存储密钥。截图中的旧密钥已经公开，不应继续使用。

雨云配置示例已经填入截图所示的桶名和宁波节点：

```env
S3_ENDPOINT=https://cn-nb1.rains3.com
S3_REGION=us-east-1
S3_BUCKET=tianjing
S3_PUBLIC_BASE_URL=https://tianjing.cn-nb1.rains3.com
S3_FORCE_PATH_STYLE=false
```

雨云 ROS 兼容 S3 API；官方示例也是使用 API 端点配合 Access Key / Secret Key。密钥只在服务端用于签发临时上传地址，绝不会返回给浏览器。

## 对象存储设置

1. 将桶设置为允许公开读取，或把 `S3_PUBLIC_BASE_URL` 改成已绑定的公开 CDN/自定义域名。
2. 在桶的 CORS 设置中允许网站域名（开发时加 `http://localhost:3000`）执行 `PUT`、`GET`、`HEAD`。
3. CORS 请求头至少允许 `Content-Type`、`Cache-Control`；方便起见也可允许 `*`。
4. Access Key 只授予这个桶的上传权限，不要使用账户级高权限密钥。

示意规则（请按雨云控制台实际表单填写）：

```json
[
  {
    "AllowedOrigins": ["https://你的域名", "http://localhost:3000"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## 数据与部署

帖子元数据默认保存在 `data/posts.json`。这是为了保持架构简单，适合单台 Node/VPS：

```bash
npm run build
npm start
```

生产部署时请确保 `data` 目录可写且被持久化，或通过 `POSTS_FILE=/data/posts.json` 指向挂载磁盘。多实例部署时再将 `lib/posts.ts` 换成数据库即可，页面和上传流程不需要变化。

当前示例照片来自 Unsplash，仅用于初始界面演示；后台发布真实帖子后可从 `data/posts.json` 删除示例数据。
