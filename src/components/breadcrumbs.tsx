import Link from "next/link";

import { AppIcon } from "./app-icon";

export type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="overflow-x-auto text-xs text-(--muted)">
      <ol className="flex min-w-max items-center gap-2">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            <AppIcon
              name={index ? "chevron" : "home"}
              className={index ? "size-3 text-(--border)" : "size-3.5 text-(--accent-strong)"}
            />
            {item.href ? <Link href={item.href} className="hover:text-(--accent-strong)">{item.label}</Link> : <span aria-current="page" className="font-medium text-(--foreground)">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
