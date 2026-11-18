import Image from "next/image";

export function TicketIcon({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/images/Ticket.png"
      alt="Ticket"
      width={size}
      height={size}
      className={`inline-block shrink-0 object-contain align-middle ${className}`}
    />
  );
}

export function VoteIcon({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/images/vote.png"
      alt="Vote"
      width={size}
      height={size}
      className={`inline-block shrink-0 object-contain align-middle ${className}`}
    />
  );
}
