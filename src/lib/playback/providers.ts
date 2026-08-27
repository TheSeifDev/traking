import type { PlaybackMetricsScope, VideoSourceType } from "@/src/types/video";

export type ProviderPlaybackKind =
  | "native_html5"
  | "youtube_iframe_api"
  | "vimeo_player_sdk"
  | "embedded_session_only";

export interface ProviderCapabilities {
  playback: boolean;
  detailed_tracking: boolean;
  seeking: boolean;
  duration: boolean;
  position: boolean;
  fullscreen: boolean;
  rate_change: boolean;
  volume: boolean;
  buffering: boolean;
  errors: boolean;
}

export interface ProviderAdapter {
  source_type: VideoSourceType;
  label: string;
  playback_kind: ProviderPlaybackKind;
  capabilities: ProviderCapabilities;
  playback_metrics_scope: PlaybackMetricsScope;
  build_embed_url(sourceUrl: string): string | null;
  thumbnail_url(sourceUrl: string): string | null;
}

const SESSION_ONLY_CAPABILITIES: ProviderCapabilities = {
  playback: true,
  detailed_tracking: false,
  seeking: false,
  duration: false,
  position: false,
  fullscreen: false,
  rate_change: false,
  volume: false,
  buffering: false,
  errors: true,
};

const NATIVE_CAPABILITIES: ProviderCapabilities = {
  playback: true,
  detailed_tracking: true,
  seeking: true,
  duration: true,
  position: true,
  fullscreen: true,
  rate_change: true,
  volume: true,
  buffering: true,
  errors: true,
};

const YOUTUBE_CAPABILITIES: ProviderCapabilities = {
  playback: true,
  detailed_tracking: true,
  seeking: true,
  duration: true,
  position: true,
  fullscreen: true,
  rate_change: true,
  volume: true,
  buffering: true,
  errors: true,
};

const VIMEO_CAPABILITIES: ProviderCapabilities = {
  playback: true,
  detailed_tracking: true,
  seeking: true,
  duration: true,
  position: true,
  fullscreen: true,
  rate_change: true,
  volume: true,
  buffering: true,
  errors: true,
};

export function getYouTubeId(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname === "youtu.be" || parsed.hostname.endsWith(".youtu.be")) {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/")[2] ?? null;
      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export function getVimeoId(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (!parsed.hostname.endsWith("vimeo.com")) return null;
    const match = parsed.pathname.match(/(?:video\/)?(\d+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function getGoogleDriveId(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    return fileMatch?.[1] ?? parsed.searchParams.get("id");
  } catch {
    return null;
  }
}

export function isValidSourceUrl(sourceType: VideoSourceType, sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (sourceType === "youtube") return getYouTubeId(sourceUrl) !== null;
    if (sourceType === "vimeo") return getVimeoId(sourceUrl) !== null;
    if (sourceType === "google_drive") return getGoogleDriveId(sourceUrl) !== null;
    return true;
  } catch {
    return false;
  }
}

const ADAPTERS: Record<VideoSourceType, ProviderAdapter> = {
  youtube: {
    source_type: "youtube",
    label: "YouTube",
    playback_kind: "youtube_iframe_api",
    capabilities: YOUTUBE_CAPABILITIES,
    playback_metrics_scope: "youtube_iframe_api",
    build_embed_url: () => null,
    thumbnail_url: (sourceUrl) => { const id = getYouTubeId(sourceUrl); return id ? `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` : null; },
  },
  vimeo: {
    source_type: "vimeo",
    label: "Vimeo",
    playback_kind: "vimeo_player_sdk",
    capabilities: VIMEO_CAPABILITIES,
    playback_metrics_scope: "vimeo_player_sdk",
    thumbnail_url: () => null,
    build_embed_url: (sourceUrl) => {
      const id = getVimeoId(sourceUrl);
      return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}?api=1&title=0&byline=0&portrait=0` : null;
    },
  },
  direct_url: {
    source_type: "direct_url",
    label: "Direct media URL",
    playback_kind: "native_html5",
    capabilities: NATIVE_CAPABILITIES,
    playback_metrics_scope: "direct_url_native_html5",
    thumbnail_url: () => null,
    build_embed_url: () => null,
  },
  google_drive: {
    source_type: "google_drive",
    label: "Google Drive",
    playback_kind: "embedded_session_only",
    capabilities: SESSION_ONLY_CAPABILITIES,
    playback_metrics_scope: "session_only",
    thumbnail_url: () => null,
    build_embed_url: (sourceUrl) => {
      const id = getGoogleDriveId(sourceUrl);
      return id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview` : sourceUrl || null;
    },
  },
  telegram: {
    source_type: "telegram",
    label: "Telegram",
    playback_kind: "embedded_session_only",
    capabilities: SESSION_ONLY_CAPABILITIES,
    playback_metrics_scope: "session_only",
    thumbnail_url: () => null,
    build_embed_url: (sourceUrl) => sourceUrl || null,
  },
};

export function getProviderAdapter(sourceType: VideoSourceType): ProviderAdapter {
  return ADAPTERS[sourceType];
}

export function getProviderLabel(sourceType: VideoSourceType): string {
  return getProviderAdapter(sourceType).label;
}

export function providerSupportsDetailedTelemetry(sourceType: VideoSourceType): boolean {
  return getProviderAdapter(sourceType).capabilities.detailed_tracking;
}

export function providerSupportsPlayback(sourceType: VideoSourceType): boolean {
  return getProviderAdapter(sourceType).capabilities.playback;
}

export function providerScope(sourceType: VideoSourceType): PlaybackMetricsScope {
  return getProviderAdapter(sourceType).playback_metrics_scope;
}

export function providerHasPositionAndDuration(sourceType: VideoSourceType): boolean {
  const { capabilities } = getProviderAdapter(sourceType);
  return capabilities.position && capabilities.duration;
}

export const PROVIDER_ADAPTERS: Readonly<Record<VideoSourceType, ProviderAdapter>> = ADAPTERS;
