"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Play } from "lucide-react";
import { youtubeId } from "@/lib/presentation";

export function VideoPreview({
  videoUrl,
  demoUrl,
  name,
}: {
  videoUrl: string;
  demoUrl: string | null;
  name: string;
}) {
  const id = youtubeId(videoUrl);
  const [playing, setPlaying] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  if (id && playing)
    return (
      <div className="video-preview">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
          title={`${name} demo video`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  if (id)
    return (
      <button
        type="button"
        className={`video-preview video-button ${imageFailed ? "video-fallback" : ""}`}
        onClick={() => setPlaying(true)}
        aria-label={`Play ${name} demo video`}
      >
        {!imageFailed && (
          <Image
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 480px) 100vw, (max-width: 1024px) 50vw, 33vw"
            onError={() => setImageFailed(true)}
          />
        )}
        <span className="play-button">
          <Play size={22} fill="currentColor" />
        </span>
        <span className="video-caption">Watch demo</span>
      </button>
    );
  return (
    <a
      className="video-preview video-fallback"
      href={demoUrl || videoUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="preview-orbit" />
      <span className="play-button">
        <Play size={22} />
      </span>
      <span className="video-caption">
        {demoUrl ? "Explore the demo" : "Watch demo video"}
        <ArrowUpRight size={16} />
      </span>
    </a>
  );
}
