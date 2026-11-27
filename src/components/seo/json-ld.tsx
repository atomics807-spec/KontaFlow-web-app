import type { JsonLdObject } from "@/lib/structured-data";

/** Renders JSON-LD with `<` escaped so content cannot break out of the script tag. */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
