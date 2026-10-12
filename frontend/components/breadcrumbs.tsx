"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";

/**
 * Trail of links derived from the current path, so the user can see where they
 * are and walk back up. Hidden on the home page.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const trail = buildBreadcrumbs(pathname);

  if (trail.length <= 1) {
    return null;
  }

  return (
    <Breadcrumb className="w-full px-6 pt-[var(--header-height)]">
      <BreadcrumbList>
        {trail.map((crumb, index) => {
          const isCurrentPage = index === trail.length - 1;

          return (
            <Fragment key={crumb.href}>
              <BreadcrumbItem>
                {isCurrentPage ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={crumb.href}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isCurrentPage ? <BreadcrumbSeparator /> : null}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
