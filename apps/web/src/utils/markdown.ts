import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.use({
  breaks: true,
  gfm: true
});

export const renderMarkdown = (source: string): string => {
  const normalized = source.trim();
  if (!normalized) {
    return '';
  }

  const rawHtml = marked.parse(normalized, { async: false });
  return DOMPurify.sanitize(rawHtml);
};

export const markdownToPlainText = (source: string): string => {
  const html = renderMarkdown(source);
  if (!html) {
    return '';
  }

  if (typeof document !== 'undefined') {
    const container = document.createElement('div');
    container.innerHTML = html;
    return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
};
