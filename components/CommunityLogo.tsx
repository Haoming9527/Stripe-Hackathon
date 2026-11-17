import Image from "next/image";

export function CommunityLogo({ priority = false }: { priority?: boolean }) {
  return (
    <Image
      src="/stripe-community-logo.png"
      alt="Stripe Community"
      width={1200}
      height={400}
      priority={priority}
      className="community-logo"
    />
  );
}
