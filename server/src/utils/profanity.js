const PROFANITY_WORDS = [
  // English
  'fuck', 'shit', 'asshole', 'bitch', 'cunt', 'bastard', 'dick', 'pussy', 'slut', 'whore',
  'chutiya', 'harami', 'saala', 'madarchod', 'behenchod', 'bhenchod', 'bsdk', 'gandu', 'kamine',
  'kamina', 'randi', 'bhosdike', 'bhosda', 'laundiatbaaz', 'muthal', 'gand', 'loda', 'lauda', 'luda'
];

/**
 * Checks text for profanity and returns sanitized text.
 * Replaces abusive words with asterisks.
 */
export function filterProfanity(text) {
  if (!text || typeof text !== 'string') return text;
  
  let filteredText = text;
  
  for (const word of PROFANITY_WORDS) {
    const regex = new RegExp(`\\b${word}\\b|${word}`, 'gi');
    filteredText = filteredText.replace(regex, (match) => '*'.repeat(match.length));
  }
  
  return filteredText;
}

/**
 * Checks if the text contains any profanity (returns true/false).
 */
export function hasProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  
  for (const word of PROFANITY_WORDS) {
    const regex = new RegExp(`\\b${word}\\b|${word}`, 'gi');
    if (regex.test(text)) {
      return true;
    }
  }
  return false;
}
