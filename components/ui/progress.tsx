import { cn } from "@/lib/utils";

/** value en 0..1 */
function Progress({
  value,
  className,
  indicatorClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("bg-primary/15 relative h-2 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className={cn("bg-primary h-full rounded-full transition-[width]", indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export { Progress };
