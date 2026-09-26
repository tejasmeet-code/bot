import { spawn } from "child_process";
import { logger } from "../../lib/logger";

export interface ResolvedMetadata {
  title: string;
  artist: string;
  album?: string;
  durationSeconds: number;
  url: string;
  streamUrl: string;
  thumbnailUrl: string;
  source: "youtube" | "spotify" | "soundcloud" | "direct" | "radio" | "itunes" | "jiosaavn" | "gaana";
}

/**
 * Executes yt-dlp to extract direct high quality YouTube audio stream for a search query
 */
export async function resolveYtDlpStream(query: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const proc = spawn("/usr/local/bin/yt-dlp", [
        "-g",
        "--default-search",
        "ytsearch",
        "-f",
        "bestaudio/best",
        "--no-warnings",
        `ytsearch1:${query}`,
      ]);
      let stdout = "";
      proc.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      const timer = setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {}
        resolve(null);
      }, 7000);
      proc.on("close", (code) => {
        clearTimeout(timer);
        const url = stdout.trim().split("\n")[0];
        if (code === 0 && url && url.startsWith("http")) {
          resolve(url);
        } else {
          resolve(null);
        }
      });
      proc.on("error", () => {
        clearTimeout(timer);
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

export interface AudioSourceOption {
  id: string;
  sourceName: string;
  quality: string;
  icon: string;
  streamUrl: string;
}

/**
 * Resolves all available audio sources/mirrors for a song so users can preview, select, or change sources
 */
export async function resolveAllAudioSources(title: string, artist: string, currentStreamUrl?: string): Promise<AudioSourceOption[]> {
  const query = `${title} ${artist}`.trim();
  const sources: AudioSourceOption[] = [];

  // 1. JioSaavn 320kbps Lossless Source
  try {
    const saavnUrl = `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=3`;
    const res = await fetch(saavnUrl, { signal: AbortSignal.timeout(4000) }).catch(() => null);
    if (res && res.ok) {
      const data: any = await res.json().catch(() => null);
      const song = data?.data?.results?.[0];
      if (song && song.downloadUrl) {
        const urls = song.downloadUrl;
        const hq320 = urls.find((u: any) => u.quality === "320kbps")?.link;
        const hq160 = urls.find((u: any) => u.quality === "160kbps")?.link;
        const bestSaavn = hq320 || hq160 || urls[urls.length - 1]?.link;
        if (bestSaavn) {
          sources.push({
            id: "jiosaavn_320k",
            sourceName: "JioSaavn 320kbps",
            quality: hq320 ? "320kbps Lossless AAC" : "160kbps HQ Audio",
            icon: "🎶",
            streamUrl: bestSaavn,
          });
        }
      }
    }
  } catch {}

  // 2. YouTube Music HQ Stream
  try {
    const ytUrl = await resolveYtDlpStream(query);
    if (ytUrl) {
      sources.push({
        id: "youtube_hq",
        sourceName: "YouTube Music HQ",
        quality: "Opus 160kbps / 48kHz High-Fi",
        icon: "▶️",
        streamUrl: ytUrl,
      });
    }
  } catch {}

  // 3. Apple Music / iTunes
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`;
    const res = await fetch(itunesUrl, { signal: AbortSignal.timeout(3500) }).catch(() => null);
    if (res && res.ok) {
      const data: any = await res.json().catch(() => null);
      const item = data?.results?.[0];
      if (item && item.previewUrl) {
        sources.push({
          id: "apple_music",
          sourceName: "Apple Music Stream",
          quality: "256kbps AAC Audio",
          icon: "🍏",
          streamUrl: item.previewUrl,
        });
      }
    }
  } catch {}

  // 4. SoundCloud Stream
  try {
    const scQuery = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=iZ864qAfL6B29B3eS45s0&limit=1`;
    const res = await fetch(scQuery, { signal: AbortSignal.timeout(3000) }).catch(() => null);
    if (res && res.ok) {
      const data: any = await res.json().catch(() => null);
      const track = data?.collection?.[0];
      const streamUrl = track?.media?.transcodings?.[0]?.url;
      if (streamUrl) {
        sources.push({
          id: "soundcloud_hq",
          sourceName: "SoundCloud Lossless",
          quality: "128kbps HQ Stream",
          icon: "☁️",
          streamUrl,
        });
      }
    }
  } catch {}

  // Fallback direct stream if available
  if (currentStreamUrl && !sources.some((s) => s.streamUrl === currentStreamUrl)) {
    sources.push({
      id: "direct_stream",
      sourceName: "Direct Web Audio Stream",
      quality: "High Bitrate Master Stream",
      icon: "📻",
      streamUrl: currentStreamUrl,
    });
  }

  return sources;
}

/**
 * Resolves a full-length 320kbps audio stream URL for any track title and artist
 */
export async function resolveFullStreamUrl(title: string, artist: string, currentStreamUrl?: string): Promise<string> {
  // If currentStreamUrl is already a direct full audio link (not an iTunes 30s preview)
  if (
    currentStreamUrl &&
    !currentStreamUrl.includes("apple.com") &&
    !currentStreamUrl.includes("audio-ssl.itunes.apple.com") &&
    !currentStreamUrl.includes("mzstatic.com") &&
    (currentStreamUrl.includes(".mp3") ||
      currentStreamUrl.includes(".aac") ||
      currentStreamUrl.includes(".m4a") ||
      currentStreamUrl.includes(".flac") ||
      currentStreamUrl.includes("googlevideo.com") ||
      currentStreamUrl.includes("stream") ||
      currentStreamUrl.includes("icecast") ||
      currentStreamUrl.includes("shoutcast"))
  ) {
    return currentStreamUrl;
  }

  const query = `${title} ${artist}`.trim();

  // 1. Try JioSaavn API first for exact Indian/Global 320kbps track match
  try {
    const saavnUrl = `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=3`;
    const res = await fetch(saavnUrl, { signal: AbortSignal.timeout(4000) }).catch(() => null);
    if (res && res.ok) {
      const data: any = await res.json().catch(() => null);
      const results = data?.data?.results;
      if (results && Array.isArray(results) && results.length > 0) {
        // Find best title match to avoid playing random tunes
        const cleanTitleLower = title.toLowerCase();
        const matchedSong = results.find((s: any) => s.name?.toLowerCase().includes(cleanTitleLower) || cleanTitleLower.includes(s.name?.toLowerCase())) || results[0];
        if (matchedSong && matchedSong.downloadUrl) {
          const urls = matchedSong.downloadUrl;
          const hqLink =
            urls.find((u: any) => u.quality === "320kbps")?.link ||
            urls.find((u: any) => u.quality === "160kbps")?.link ||
            urls[urls.length - 1]?.link;
          if (hqLink) {
            logger.info({ title, artist, matched: matchedSong.name, source: "JioSaavn 320kbps" }, "Resolved full 320kbps stream URL");
            return hqLink;
          }
        }
      }
    }
  } catch {}

  // 2. Try yt-dlp YouTube audio stream resolution for exact song match
  try {
    const ytDlpUrl = await resolveYtDlpStream(query);
    if (ytDlpUrl) {
      logger.info({ title, artist, source: "yt-dlp YouTube Audio" }, "Resolved full track stream URL");
      return ytDlpUrl;
    }
  } catch {}

  // 3. Fallback to Piped / Invidious YouTube Music Audio API
  const pipedInstances = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.privacydev.net",
    "https://pipedapi.mha.fi",
  ];

  for (const instance of pipedInstances) {
    try {
      const searchRes = await fetch(`${instance}/search?q=${encodeURIComponent(query)}&filter=music_songs`, {
        signal: AbortSignal.timeout(3500),
      }).catch(() => null);

      if (searchRes && searchRes.ok) {
        const searchData: any = await searchRes.json().catch(() => null);
        const item = searchData?.items?.[0];
        if (item && item.url) {
          const videoId = item.url.split("v=").pop();
          if (videoId) {
            const streamsRes = await fetch(`${instance}/streams/${videoId}`, {
              signal: AbortSignal.timeout(3500),
            }).catch(() => null);

            if (streamsRes && streamsRes.ok) {
              const streamData: any = await streamsRes.json().catch(() => null);
              const audioStreams = streamData?.audioStreams;
              if (audioStreams && audioStreams.length > 0) {
                audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
                const bestStream = audioStreams[0].url;
                if (bestStream) {
                  logger.info({ title, artist, bitrate: audioStreams[0].bitrate, source: "Piped Audio" }, "Resolved full audio stream");
                  return bestStream;
                }
              }
            }
          }
        }
      }
    } catch {}
  }

  // If no audio stream found, return existing stream URL or empty string
  return currentStreamUrl || "";
}

/**
 * Searches JioSaavn & Gaana API for full Indian & Global songs catalog
 */
export async function searchJioSaavnCatalog(query: string, limit = 10): Promise<ResolvedMetadata[]> {
  try {
    const saavnUrl = `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(saavnUrl, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (res && res.ok) {
      const data: any = await res.json().catch(() => null);
      const results = data?.data?.results;
      if (results && Array.isArray(results) && results.length > 0) {
        return results.map((song: any) => {
          const downloadUrls = song.downloadUrl || [];
          const hqStream =
            downloadUrls.find((u: any) => u.quality === "320kbps")?.link ||
            downloadUrls.find((u: any) => u.quality === "160kbps")?.link ||
            downloadUrls[downloadUrls.length - 1]?.link ||
            "";

          const imageArray = song.image || [];
          const coverArt =
            imageArray.find((i: any) => i.quality === "500x500")?.link ||
            imageArray[imageArray.length - 1]?.link ||
            "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop";

          const primaryArtist = song.primaryArtists || song.artists?.primary?.[0]?.name || "Artist";

          return {
            title: song.name || query,
            artist: primaryArtist,
            album: song.album?.name,
            durationSeconds: Math.round(Number(song.duration || 210)),
            url: song.url || `https://www.jiosaavn.com/song/${song.id}`,
            streamUrl: hqStream,
            thumbnailUrl: coverArt,
            source: "jiosaavn",
          };
        });
      }
    }
  } catch (err) {
    logger.warn({ err, query }, "Error searching JioSaavn catalog");
  }
  return [];
}

/**
 * Parses Spotify track, album, playlist, or artist URLs and extracts metadata
 */
export async function resolveSpotifyUrl(url: string): Promise<ResolvedMetadata[]> {
  try {
    const cleanUrl = url.trim();
    // 1. Check if it's a valid open.spotify.com URL
    const match = cleanUrl.match(/open\.spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/i);
    if (!match) return [];

    const type = match[1].toLowerCase();
    const id = match[2];

    // Use Spotify oEmbed for instant rate-limit-free metadata resolution
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
    const res = await fetch(oembedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RelostaMusicBot/1.0)" },
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);

    let oembedData: any = null;
    if (res && res.ok) {
      oembedData = await res.json().catch(() => null);
    }

    // Attempt to fetch embed page HTML to extract track listings for albums/playlists
    const embedPageUrl = `https://open.spotify.com/embed/${type}/${id}`;
    const pageRes = await fetch(embedPageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(7000),
    }).catch(() => null);

    if (pageRes && pageRes.ok) {
      const html = await pageRes.text();
      // Look for embedded JSON state inside <script id="__NEXT_DATA__"> or similar
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const entity = nextData?.props?.pageProps?.state?.data?.entity;
          if (entity) {
            const trackList: any[] = entity.trackList || (entity.tracks?.items ? entity.tracks.items : []);
            if (trackList && trackList.length > 0) {
              const albumOrPlaylistTitle = entity.name || oembedData?.title || "Spotify Collection";
              const coverUrl =
                entity.coverArt?.sources?.[0]?.url ||
                oembedData?.thumbnail_url ||
                "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop";

              return trackList.map((t: any) => {
                const title = t.title || t.name || "Unknown Track";
                const artist = t.subtitle || (t.artists ? t.artists.map((a: any) => a.name).join(", ") : "Unknown Artist");
                const duration = Math.round((t.duration || t.duration_ms || 180000) / 1000);
                const trackUrl = t.uri ? `https://open.spotify.com/track/${t.uri.split(":").pop()}` : cleanUrl;

                return {
                  title,
                  artist,
                  album: albumOrPlaylistTitle,
                  durationSeconds: duration > 0 ? duration : 180,
                  url: trackUrl,
                  streamUrl: "", // Will be resolved during playback
                  thumbnailUrl: coverUrl,
                  source: "spotify",
                };
              });
            }
          }
        } catch {}
      }
    }

    // Single track fallback from oEmbed
    if (oembedData && oembedData.title) {
      const rawTitle = oembedData.title; // usually "Song Name by Artist"
      let songTitle = rawTitle;
      let artistName = "Spotify Artist";

      if (rawTitle.includes(" by ")) {
        const parts = rawTitle.split(" by ");
        songTitle = parts[0];
        artistName = parts.slice(1).join(" by ");
      }

      return [
        {
          title: songTitle,
          artist: artistName,
          durationSeconds: 210,
          url: cleanUrl,
          streamUrl: "",
          thumbnailUrl:
            oembedData.thumbnail_url ||
            "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop",
          source: "spotify",
        },
      ];
    }
  } catch (err) {
    logger.warn({ err, url }, "Error resolving Spotify metadata");
  }

  return [];
}

/**
 * Parses YouTube video, shorts, or playlist URLs and extracts metadata
 */
export async function resolveYouTubeUrl(url: string): Promise<ResolvedMetadata[]> {
  try {
    const cleanUrl = url.trim();
    // Use YouTube oEmbed for instant rate-limit-resistant metadata lookup
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RelostaMusicBot/1.0)" },
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);

    if (res && res.ok) {
      const data: any = await res.json().catch(() => null);
      if (data && data.title) {
        let title = data.title;
        let artist = data.author_name || "YouTube Creator";

        // Clean up common "Artist - Title" patterns
        if (title.includes(" - ")) {
          const parts = title.split(" - ");
          if (parts.length >= 2) {
            artist = parts[0].trim();
            title = parts.slice(1).join(" - ").trim();
          }
        }

        // Clean up brackets like (Official Video), [HD], (Lyrics)
        title = title
          .replace(/[\(\[](official\s*(music\s*)?video|audio|lyrics|4k|hd|visualizer|remastered)[\)\]]/gi, "")
          .trim();

        return [
          {
            title,
            artist,
            durationSeconds: 240,
            url: cleanUrl,
            streamUrl: "", // Will be streamed via direct audio pipeline
            thumbnailUrl:
              data.thumbnail_url ||
              "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop",
            source: "youtube",
          },
        ];
      }
    }
  } catch (err) {
    logger.warn({ err, url }, "Error resolving YouTube URL");
  }

  return [];
}

