import type { SavedWord } from '@/types';

export interface SavedMatchMap {
  singleWordIndexes: Set<number>;
  phraseIndexes: Set<number>;
}

function normalizeToken(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/^[^a-z0-9'-]+|[^a-z0-9'-]+$/gi, '')
    .trim();
}

function tokenizeTerm(value: string): string[] {
  return (value || '')
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);
}

export function buildSavedMatchMap(words: string[], savedWords: SavedWord[]): SavedMatchMap {
  const normalizedWords = words.map(normalizeToken);
  const singleWordIndexes = new Set<number>();
  const phraseIndexes = new Set<number>();

  const singleTerms = new Set<string>();
  const phraseTerms: string[][] = [];
  const seenPhrases = new Set<string>();

  for (const saved of savedWords) {
    const tokens = tokenizeTerm(saved.word || '');
    if (!tokens.length) continue;

    if (tokens.length === 1) {
      singleTerms.add(tokens[0]);
      continue;
    }

    const key = tokens.join(' ');
    if (!seenPhrases.has(key)) {
      seenPhrases.add(key);
      phraseTerms.push(tokens);
    }
  }

  phraseTerms.sort((a, b) => b.length - a.length);

  normalizedWords.forEach((word, index) => {
    if (word && singleTerms.has(word)) {
      singleWordIndexes.add(index);
    }
  });

  for (const phrase of phraseTerms) {
    const phraseLength = phrase.length;
    if (!phraseLength || phraseLength > normalizedWords.length) continue;

    for (let start = 0; start <= normalizedWords.length - phraseLength; start++) {
      let matches = true;
      for (let offset = 0; offset < phraseLength; offset++) {
        if (normalizedWords[start + offset] !== phrase[offset]) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
      for (let offset = 0; offset < phraseLength; offset++) {
        phraseIndexes.add(start + offset);
      }
    }
  }

  return { singleWordIndexes, phraseIndexes };
}
