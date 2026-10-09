"use client";

import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@/components/icons";

export function DetailHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <header className="detail-header">
      <button type="button" onClick={() => router.back()} aria-label="返回上一页">
        <ChevronLeftIcon />
      </button>
      <span>{title}</span>
      <i aria-hidden="true" />
    </header>
  );
}
