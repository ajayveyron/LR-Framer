"use client";

import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef, CSSProperties, ElementType } from "react";
import { memo } from "react";
import { motion } from "framer-motion";

type ShimmerOwnProps<T extends ElementType = "p"> = {
  as?: T;
  children: string;
  className?: string;
  duration?: number;
  spread?: number;
};

export type ShimmerProps<T extends ElementType = "p"> = ShimmerOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof ShimmerOwnProps>;

const ShimmerComponent = <T extends ElementType = "p">({
  as,
  children,
  className,
  duration = 2,
  spread,
  style,
  ...props
}: ShimmerProps<T>) => {
  const Comp = (as ?? "p") as ElementType;
  const resolvedSpread = spread ?? Math.max(2, Math.ceil(children.length / 8));
  const shimmerStyle = {
    backgroundImage:
      "linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.62) 18%, rgba(255,255,255,0.98) 34%, rgba(255,255,255,0.62) 50%, rgba(255,255,255,0.3) 68%)",
    backgroundRepeat: "no-repeat",
    backgroundSize: `${resolvedSpread * 100}% 100%`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
  } satisfies CSSProperties;

  return (
    <Comp
      style={style}
      {...props}
    >
      <motion.span
        animate={{
          backgroundPosition: [
            `-${resolvedSpread * 100}% 0%`,
            `${resolvedSpread * 100}% 0%`,
          ],
        }}
        className={cn("inline-block text-transparent", className)}
        style={shimmerStyle}
        transition={{
          duration,
          ease: "linear",
          repeat: Number.POSITIVE_INFINITY,
        }}
      >
        {children}
      </motion.span>
    </Comp>
  );
};

export const Shimmer = memo(ShimmerComponent) as typeof ShimmerComponent;
