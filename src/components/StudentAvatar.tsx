import { initials } from "@/lib/attendance";

/**
 * Passport-style student avatar. Falls back to initials when no photo exists.
 */
export function StudentAvatar({
  name,
  photoUrl,
  size = 44,
  rounded = "full",
  className = "",
  glow = false,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  rounded?: "full" | "passport";
  className?: string;
  glow?: boolean;
}) {
  const isPassport = rounded === "passport";
  const style: React.CSSProperties = isPassport
    ? { width: size, height: Math.round((size * 4) / 3) }
    : { width: size, height: size };

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        loading="lazy"
        className={`shrink-0 object-cover border border-white/25 bg-muted ${
          isPassport ? "rounded-xl" : "rounded-full"
        } ${glow ? "shadow-[0_0_30px_rgba(96,165,250,0.5)]" : ""} ${className}`}
        style={style}
      />
    );
  }

  return (
    <div
      className={`shrink-0 flex items-center justify-center font-bold text-white ${
        isPassport ? "rounded-xl" : "rounded-full"
      } ${className}`}
      style={{
        ...style,
        fontSize: Math.max(12, Math.round(size * 0.38)),
        background: "radial-gradient(circle at 30% 30%, #60A5FA, #2563EB)",
        boxShadow: glow
          ? "0 0 30px rgba(96,165,250,0.6), inset 0 1px 0 rgba(255,255,255,0.4)"
          : "inset 0 1px 0 rgba(255,255,255,0.35)",
      }}
    >
      {initials(name)}
    </div>
  );
}
