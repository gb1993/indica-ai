import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="overflow-x-auto text-sm text-(--muted)">
      <ol className="flex min-w-max items-center gap-2">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            {index ? <span aria-hidden>/</span> : null}
            {item.href ? <Link href={item.href} className="hover:text-(--foreground) hover:underline">{item.label}</Link> : <span aria-current="page" className="text-(--foreground)">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
