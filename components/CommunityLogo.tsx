import Image from "next/image";

export function CommunityLogo() {
  return (
    <Image
      src="/stripe-community-logo.png"
      alt="Stripe Community"
      width={1200}
      height={400}
      loading="eager"
      className="community-logo"
    />
  );
}
