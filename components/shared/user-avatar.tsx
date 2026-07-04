import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import type { Profile } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export interface UserAvatarProps {
  profile: Pick<Profile, "full_name" | "avatar_url" | "email"> | null;
  className?: string;
}

/** Avatar with graceful fallbacks: photo → initials from name → email → "?". */
export function UserAvatar({ profile, className }: UserAvatarProps) {
  const name = profile?.full_name || profile?.email || null;

  return (
    <Avatar className={cn(className)}>
      {profile?.avatar_url ? (
        <AvatarImage src={profile.avatar_url} alt={name ?? "User avatar"} />
      ) : null}
      <AvatarFallback className="text-xs font-medium uppercase">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
