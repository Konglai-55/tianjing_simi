import Link from "next/link";

export default function NotFound() {
  return <main className="not-found"><span>404</span><h1>这篇内容暂时找不到</h1><Link href="/">返回首页</Link></main>;
}
