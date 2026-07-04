import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import { APP_NAME, ROUTES } from "@/lib/constants";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <Link
          href={ROUTES.home}
          className="mb-8 flex items-center justify-center gap-2.5"
          aria-label={`${APP_NAME} home`}
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HeartHandshake className="size-5" aria-hidden="true" />
          </span>
          <span className="text-xl font-semibold tracking-tight">
            {APP_NAME}
          </span>
        </Link>
        <main>{children}</main>
        <p className="mx-auto mt-8 max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
          Plan, save, and grow together — while keeping the independence you
          each need.
        </p>
      </div>
    </div>
  );
}
