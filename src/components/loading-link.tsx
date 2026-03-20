"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type LoadingLinkProps = Omit<
  React.ComponentProps<typeof Link>,
  "href" | "children"
> & {
  href: string;
  children: React.ReactNode;
  pendingClassName?: string;
  spinnerClassName?: string;
};

function isPlainLeftClick(event: React.MouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export const LoadingLink = React.forwardRef<
  HTMLAnchorElement,
  LoadingLinkProps
>(function LoadingLink(
  {
    children,
    className,
    href,
    onClick,
    pendingClassName,
    prefetch,
    spinnerClassName,
    ...props
  },
  ref,
) {
  const pathname = usePathname();
  const [isPending, setIsPending] = React.useState(false);

  React.useEffect(() => {
    setIsPending(false);
  }, [pathname]);

  return (
    <Link
      {...props}
      ref={ref}
      aria-busy={isPending}
      className={cn(className, isPending && pendingClassName)}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          !isPlainLeftClick(event) ||
          props.target === "_blank" ||
          href === pathname
        ) {
          return;
        }

        setIsPending(true);
      }}
      prefetch={prefetch}
    >
      <span className="inline-flex items-center gap-2">
        {isPending ? <Spinner className={cn("size-3.5", spinnerClassName)} /> : null}
        <span>{children}</span>
      </span>
    </Link>
  );
});
