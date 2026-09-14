const SIZES = {
  sm: "h-9 w-9",
  lg: "h-10 w-10",
} as const;

export function BotAvatar({ size = "sm" }: { size?: keyof typeof SIZES }) {
  return (
    <div
      className={`${SIZES[size]} shrink-0 overflow-hidden rounded-full bg-waz-10 ring-1 ring-waz-50/50`}
      style={{
        backgroundImage: "url(/brand/waz.png)",
        backgroundSize: "550%",
        backgroundPosition: "50% 8%",
        backgroundRepeat: "no-repeat",
      }}
      role="img"
      aria-label="Waz"
    />
  );
}
