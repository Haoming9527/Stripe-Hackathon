"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Play } from "lucide-react";
import { safeExternalUrl, youtubeId } from "@/lib/presentation";

export function VideoPreview({
  videoUrl,
  demoUrl,
  name,
}: {
  videoUrl?: string | null;
  demoUrl?: string | null;
  name: string;
}) {
  const video = safeExternalUrl(videoUrl);
  const id = video ? youtubeId(video) : null;
  const [playingId, setPlayingId] = useState<string>();
  const [failedPosterId, setFailedPosterId] = useState<string>();
  const [failedVideoUrl, setFailedVideoUrl] = useState<string>();
  if (id && playingId === id)
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
        className={`video-preview video-button ${failedPosterId === id ? "video-fallback" : ""}`}
        onClick={() => setPlayingId(id)}
        aria-label={`Play ${name} demo video`}
      >
        {failedPosterId !== id && (
          <Image
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 700px) 100vw, 50vw"
            onError={() => setFailedPosterId(id)}
          />
        )}
        <span className="play-button">
          <Play size={22} fill="currentColor" />
        </span>
        <span className="video-caption">Watch video</span>
      </button>
    );
  if (
    video &&
    failedVideoUrl !== video &&
    /\.(?:mp4|m4v|mov|webm|ogv|ogg)$/i.test(new URL(video).pathname)
  ) {
    return (
      <div className="video-preview">
        <video
          controls
          playsInline
          preload="metadata"
          src={video}
          aria-label={`${name} demo video`}
          onError={() => setFailedVideoUrl(video)}
        >
          <a href={video} target="_blank" rel="noopener noreferrer">
            Watch video
          </a>
        </video>
      </div>
    );
  }
  const href = video || safeExternalUrl(demoUrl);
  if (!href) return null;
  return (
    <a
      className="video-preview video-fallback"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={video ? `Watch ${name} video` : `Open ${name} demo`}
    >
      <span className="play-button">
        {video ? <Play size={22} /> : <ArrowUpRight size={22} />}
      </span>
      <span className="video-caption">
        {video ? "Watch video" : "Open demo"}
        <ArrowUpRight size={16} />
      </span>
    </a>
  );
}
