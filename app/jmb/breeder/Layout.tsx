"use client";
import React, { useEffect } from "react";
import Link from "next/link"; // Import the Next.js Link component
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react"; // Rename icon to avoid name conflict
import { NavFolders } from "@/lib/Defaults/DefaultValues";

export default function Layout() {
  const router = useRouter();

  useEffect(() => {
    NavFolders[2]?.items?.forEach((group) => {
      group.children?.forEach((child: any) => {
        if (child.url && child.url !== "#") {
          router.prefetch(child.url);
        }
      });
    });
  }, [router]);

  return (
    <div className="grid gap-8 grid-cols-1 mx-4">
      <div className="mt-4">
        <div className="font-bold text-lg">Masters and Reports</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {NavFolders[2].items.map((item, i) => (
            <div key={i} className="w-full">
              <div className="mt-4 font-bold border-b pb-1 mb-2">
                {item.group}
              </div>
              <div className="grid gap-2">
                {item.children.map((itemx: any, ii: number) => (
                  <div className="flex gap-2 items-center group" key={ii}>
                    <Link href={itemx.url} className="">
                      {itemx.title}
                    </Link>

                    <a
                      href={itemx.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="size-3 text-muted-foreground" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
