import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { buildBreadcrumbJsonLd } from "@/lib/seo/json-ld";

export type Crumb = {
  /** Human-readable label shown in the trail and in the schema.org item. */
  name: string;
  /** Locale-relative path, e.g. "/clubs" or "" for home. */
  path: string;
};

/**
 * Visible breadcrumb trail + schema.org `BreadcrumbList` JSON-LD.
 *
 * Pass the full chain INCLUDING the current page as the last item. The last
 * item renders as plain text (`aria-current="page"`); the rest are links.
 * Google reads the JSON-LD to show the hierarchy in the SERP.
 */
export function Breadcrumbs({ items, locale }: { items: Crumb[]; locale: string }) {
  if (items.length < 2) return null;

  return (
    <>
      <JsonLdScript data={buildBreadcrumbJsonLd(items, locale)} />
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink-500">
          {items.map((c, i) => {
            const last = i === items.length - 1;
            return (
              <li key={`${c.path}-${i}`} className="inline-flex min-w-0 items-center gap-1.5">
                {i > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-300" aria-hidden />
                )}
                {last ? (
                  <span
                    aria-current="page"
                    className="max-w-[70vw] truncate font-medium text-ink-700"
                  >
                    {c.name}
                  </span>
                ) : (
                  <Link
                    href={`/${locale}${c.path}`}
                    className="transition-colors hover:text-grass-700"
                  >
                    {c.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
