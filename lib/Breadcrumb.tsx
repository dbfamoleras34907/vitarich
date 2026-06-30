import Link from "next/link";

interface BreadcrumbProps {
  CurrentPageName: string;
  FirstPreviewsPageName?: string;
  FirstPreviewsPageLink?: string;
  SecondPreviewPageName?: string;
  SecondPreviewPageLink?: string;
}

const Breadcrumb = ({
  CurrentPageName,
  FirstPreviewsPageName,
  FirstPreviewsPageLink,
  SecondPreviewPageName,
  SecondPreviewPageLink,
}: BreadcrumbProps) => {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-col">
      
      {/* Page Title - Always Visible */}
      <h1 className="pb-1 text-2xl font-semibold text-[var(--starbucks-green)]">
        {CurrentPageName}
      </h1>

      {/* Breadcrumb Links - Hidden on md and smaller */}
      <ol className="hidden items-center gap-2 whitespace-nowrap text-sm text-muted-foreground md:flex">
        
        {SecondPreviewPageName && (
          <>
            <li>
              <Link
                href={SecondPreviewPageLink || "#"}
                className="transition-colors hover:text-primary hover:underline"
              >
                {SecondPreviewPageName}
              </Link>
            </li>
            <span>/</span>
          </>
        )}

        {FirstPreviewsPageName && (
          <>
            <li>
              <Link
                href={FirstPreviewsPageLink || "#"}
                className="transition-colors hover:text-primary hover:underline"
              >
                {FirstPreviewsPageName}
              </Link>
            </li>
            <span>/</span>
          </>
        )}

        <li className="font-semibold text-foreground" aria-current="page">
          {CurrentPageName}
        </li>

      </ol>
    </nav>
  );
};

export default Breadcrumb;
