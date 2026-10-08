import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportMenu({ tripId }: { tripId: string }) {
  const base = `/api/trips/${tripId}/export`;
  return (
    <div className="flex gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={`${base}?format=csv`} download>
          <FileSpreadsheet /> CSV
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={`${base}?format=pdf`} download>
          <FileText /> PDF
        </a>
      </Button>
    </div>
  );
}
