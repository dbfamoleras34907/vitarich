"use client";

import Link from "next/link";
import { useEffect } from "react";

interface BreadcrumbProps {
  CurrentPageName: string;
  FirstPreviewsPageName?: string;
  FirstPreviewsPageLink?: string;
  SecondPreviewPageName?: string;
  SecondPreviewPageLink?: string;
}

const getBrowserTitle = (
  currentPageName: string,
  parentPageName?: string,
) => {
  const actionMatch = currentPageName.trim().match(/^(new|create|edit|view|post|print)\b/i);

  if (actionMatch && parentPageName) {
    const action = /^create new\b/i.test(currentPageName.trim())
      ? "new"
      : actionMatch[1].toLowerCase();
    return `${parentPageName} / ${action.charAt(0).toUpperCase()}${action.slice(1)}`;
  }

  return currentPageName;
};

const Breadcrumb = ({
  CurrentPageName,
  FirstPreviewsPageName,
  FirstPreviewsPageLink,
  SecondPreviewPageName,
  SecondPreviewPageLink,
}: BreadcrumbProps) => {
  useEffect(() => {
    document.title = getBrowserTitle(CurrentPageName, FirstPreviewsPageName);
  }, [CurrentPageName, FirstPreviewsPageName]);

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-col-reverse gap-0.5">
      <h1 className="truncate text-xl font-semibold leading-6 tracking-tight text-foreground">
        {CurrentPageName}
      </h1>

      <ol className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] leading-4 text-muted-foreground">
        {SecondPreviewPageName && (
          <>
            <li className="min-w-0 truncate">
              <Link
                href={SecondPreviewPageLink || "#"}
                className="transition-colors hover:text-primary"
              >
                {SecondPreviewPageName}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
          </>
        )}

        {FirstPreviewsPageName && (
          <>
            <li className="min-w-0 truncate">
              <Link
                href={FirstPreviewsPageLink || "#"}
                className="transition-colors hover:text-primary"
              >
                {FirstPreviewsPageName}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
          </>
        )}

        <li className="min-w-0 truncate font-medium text-foreground" aria-current="page">
          {CurrentPageName}
        </li>
      </ol>
    </nav>
  );
};

export default Breadcrumb;
