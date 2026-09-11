import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

function Skeleton({ className, shimmer = true, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-muted/50",
        shimmer && "skeleton-shimmer",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };

