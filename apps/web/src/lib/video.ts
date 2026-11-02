export type VideoSource =
  | { kind: 'file'; src: string }
  | { kind: 'youtube'; id: string; embed: string }
  | { kind: 'vimeo'; id: string; embed: string }
  | { kind: 'embed'; embed: string };

const FILE_PATTERN = /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i;

function youtubeId(url: string) {
  if (url.includes('/embed/')) return url.split('/embed/')[1]?.split(/[?&#]/)[0] ?? '';
  if (url.includes('watch?v=')) return url.split('watch?v=')[1]?.split(/[&#]/)[0] ?? '';
  if (url.includes('youtu.be/')) return url.split('youtu.be/')[1]?.split(/[?&#]/)[0] ?? '';
  if (url.includes('/shorts/')) return url.split('/shorts/')[1]?.split(/[?&#]/)[0] ?? '';
  return '';
}

function vimeoId(url: string) {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match?.[1] ?? '';
}

/**
 * Classifies a lesson URL. Uploaded files play in a real <video>, which is what makes
 * scrubbing to a comment's timestamp and automatic progress tracking possible; hosted
 * players fall back to an embed with the chrome turned down.
 */
export function resolveVideo(url: string): VideoSource {
  if (FILE_PATTERN.test(url) || url.startsWith('/uploads/')) return { kind: 'file', src: url };

  const yt = url.includes('youtube.com') || url.includes('youtu.be') ? youtubeId(url) : '';
  if (yt) {
    return {
      kind: 'youtube',
      id: yt,
      embed: `https://www.youtube-nocookie.com/embed/${yt}?modestbranding=1&rel=0&iv_load_policy=3&fs=1&playsinline=1`
    };
  }

  const vimeo = url.includes('vimeo.com') ? vimeoId(url) : '';
  if (vimeo) {
    return {
      kind: 'vimeo',
      id: vimeo,
      embed: `https://player.vimeo.com/video/${vimeo}?title=0&byline=0&portrait=0&dnt=1`
    };
  }

  return { kind: 'embed', embed: url };
}

/** Deep link that opens a hosted player at a given second. */
export function embedAtTimestamp(source: VideoSource, seconds: number) {
  if (source.kind === 'youtube') return `https://youtu.be/${source.id}?t=${Math.floor(seconds)}`;
  if (source.kind === 'vimeo') return `https://vimeo.com/${source.id}#t=${Math.floor(seconds)}s`;
  return null;
}
