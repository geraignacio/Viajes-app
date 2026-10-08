import { cn, initials } from "@/lib/utils";

function Avatar({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "bg-muted text-muted-foreground relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-medium",
        className,
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export { Avatar };
