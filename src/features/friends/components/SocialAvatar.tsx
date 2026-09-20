import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getSocialDisplayName, getSocialInitials } from "../socialUtils";

interface SocialAvatarProps {
  fullName: string | null;
  username: string | null;
  isOnline?: boolean;
  size?: "sm" | "md" | "lg";
}

export function SocialAvatar({ fullName, username, isOnline = false, size = "md" }: SocialAvatarProps) {
  const name = getSocialDisplayName(fullName, username);
  const sizeClass = { sm: "size-9", md: "size-11", lg: "size-16" }[size];

  return (
    <span className="relative inline-flex shrink-0">
      <Avatar className={cn(sizeClass, "border border-border/60") }>
        <AvatarFallback className="bg-primary/10 font-semibold text-primary">
          {getSocialInitials(fullName, username)}
        </AvatarFallback>
      </Avatar>
      <span
        aria-label={isOnline ? `${name} está online` : `${name} está offline`}
        className={cn(
          "absolute bottom-0 right-0 rounded-full border-2 border-card",
          size === "lg" ? "size-4" : "size-3",
          isOnline ? "bg-success" : "bg-muted-foreground/40",
        )}
      />
    </span>
  );
}
