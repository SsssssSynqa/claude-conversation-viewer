const EMOJI_GRAPHEME = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)/u;

/**
 * Return complete emoji graphemes instead of splitting skin tones, flags, or
 * zero-width-joiner sequences into separate ranking entries.
 */
export function extractEmojis(text) {
  if (typeof text !== 'string' || text.length === 0) return [];

  if (typeof Intl?.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return [...segmenter.segment(text)]
      .map(({ segment }) => segment)
      .filter(segment => EMOJI_GRAPHEME.test(segment));
  }

  return text.match(/(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:\uFE0F)?(?:\p{Emoji_Modifier})?(?:\u200D(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:\uFE0F)?(?:\p{Emoji_Modifier})?)*)/gu) || [];
}
