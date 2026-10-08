"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) router.push(`/join/${code.trim().toUpperCase()}`);
      }}
    >
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Código de invitación"
        className="uppercase sm:w-48"
        aria-label="Código de invitación"
      />
      <Button type="submit" variant="outline">
        Unirme
      </Button>
    </form>
  );
}
