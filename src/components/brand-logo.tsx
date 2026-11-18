import Image from "next/image";

export function BrandLogo({
  className = "",
  height = 46,
  priority = false,
}: {
  className?: string;
  height?: number;
  priority?: boolean;
}) {
  const width = Math.round(height * 1.55);
  return (
    <span className={`inline-flex items-center shrink-0 select-none ${className}`}>
      <Image
        src="/images/votecasthub-logo.png"
        alt="VoteCastHub GH"
        width={width}
        height={height}
        style={{ height: `${height}px`, width: "auto" }}
        className="max-h-[64px] w-auto object-contain transition-transform duration-200"
        priority={priority}
      />
    </span>
  );
}
