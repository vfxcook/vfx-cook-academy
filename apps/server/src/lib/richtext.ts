import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const allowedTags = [
  'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'hr'
];

const allowedAttributes: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'title']
};

/** Markdown lesson notes are authored by admins but still sanitised before storage. */
export function renderLessonDescription(raw: string | null | undefined): string {
  const input = (raw ?? '').trim();
  if (!input) return '';

  const html = marked.parse(input, { breaks: true, gfm: true, async: false }) as string;
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
    transformTags: {
      a: (_tag, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, target: '_blank', rel: 'noreferrer noopener' }
      })
    }
  });
}
