import { serializeJsonLd } from "@/lib/seo/json-ld";

type Props = {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
};

/** Renders one or more schema.org JSON-LD blocks. */
export function JsonLdScript({ data }: Props) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(block) }}
        />
      ))}
    </>
  );
}
