"use client";

import Image from "next/image";
import { useState } from "react";
import { safeExternalUrl } from "@/lib/presentation";

export function AccountAvatar({
  email,
  name,
  image,
}: {
  email: string;
  name: string | null;
  image: string | null;
}) {
  const [failedImage, setFailedImage] = useState<string>();
  const photo = safeExternalUrl(image);

  return (
    <span className="account-avatar" title={email}>
      {photo?.startsWith("https://") && photo !== failedImage ? (
        <Image
          src={photo}
          alt={name ? `${name}’s Google profile photo` : "Google profile photo"}
          width={32}
          height={32}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setFailedImage(photo)}
        />
      ) : (
        (name || email).slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
