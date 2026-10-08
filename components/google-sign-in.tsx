import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export function GoogleSignIn({ redirectTo = "/trips" }: { redirectTo?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo });
      }}
    >
      <Button type="submit" size="lg" className="w-full">
        <svg viewBox="0 0 24 24" aria-hidden className="size-4">
          <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.84 0 3.07.78 3.77 1.45l2.57-2.48C16.7 3.7 14.56 2.75 12 2.75 6.9 2.75 2.75 6.9 2.75 12s4.15 9.25 9.25 9.25c5.34 0 8.88-3.75 8.88-9.04 0-.6-.07-1.06-.15-1.51Z" />
        </svg>
        Continuar con Google
      </Button>
    </form>
  );
}
