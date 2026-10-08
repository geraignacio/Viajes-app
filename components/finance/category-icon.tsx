import { BedDouble, Package, Plane, Ticket, UtensilsCrossed } from "lucide-react";
import type { Category } from "@/lib/constants";

const ICONS = {
  LODGING: BedDouble,
  TRANSPORT: Plane,
  FOOD: UtensilsCrossed,
  ACTIVITIES: Ticket,
  OTHER: Package,
} satisfies Record<Category, React.ComponentType<{ className?: string }>>;

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const Icon = ICONS[category];
  return <Icon className={className} />;
}
