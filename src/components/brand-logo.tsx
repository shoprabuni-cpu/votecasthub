import Image from "next/image";

export function BrandLogo({
  className = "",
  height = 38,
  priority = false,
}: {
  className?: string;
  height?: number;
  priority?: boolean;
}) {
  const width = Math.round(height * 1.5);
  return (
    <span className={`inline-flex items-center shrink-0 select-none ${className}`}>
      <Image
        src="/images/votecasthub-logo.png"
        alt="VoteCastHub GH"
        width={width}
        height={height}
        style={{ height: `${height}px`, width: "auto" }}
        className="max-h-[46px] w-auto object-contain"
        priority={priority}
      />
    </span>
  );
}
