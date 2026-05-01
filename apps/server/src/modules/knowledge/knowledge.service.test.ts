import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeConvertedMarkdown } from './knowledge.service.js';

test('sanitizeConvertedMarkdown removes oversized dashed table border artifacts', () => {
  const input = [
    '| Col A | Col B |',
    '|--------------------------------------------------------------------|',
    '| value A | value B |'
  ].join('\n');

  const sanitized = sanitizeConvertedMarkdown(input);

  assert.equal(
    sanitized,
    ['| Col A | Col B |', '| value A | value B |'].join('\n')
  );
});

test('sanitizeConvertedMarkdown keeps valid markdown table separators', () => {
  const input = [
    '| Col A | Col B |',
    '| --- | --- |',
    '| value A | value B |'
  ].join('\n');

  const sanitized = sanitizeConvertedMarkdown(input);

  assert.equal(sanitized, input);
});
