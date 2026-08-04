import User from '../models/User.js';

const ADJECTIVES = [
  'Sleepy', 'Arctic', 'Happy', 'Lazy', 'Clever', 'Sneaky', 'Cosmic', 'Neon', 
  'Chill', 'Silent', 'Dancing', 'Fuzzy', 'Spicy', 'Golden', 'Mighty', 
  'Wandering', 'Gentle', 'Jolly', 'Shy', 'Swift', 'Brave', 'Wild', 'Frosty',
  'Hidden', 'Daring', 'Kind', 'Alert', 'Calm', 'Hyper', 'Polite'
];

const NOUNS = [
  'Panda', 'Fox', 'Bear', 'Wolf', 'Koala', 'Owl', 'Tiger', 'Rabbit', 'Penguin', 
  'Otter', 'Badger', 'Dolphin', 'Hedgehog', 'Squirrel', 'Raccoon', 'Coffee Bean', 
  'Blue Ocean', 'Mango Slice', 'Night Owl', 'Thunder Wolf', 'Arctic Fox', 
  'Cheetah', 'Leopard', 'Panther', 'Eagle', 'Falcon', 'Seal', 'Beaver', 'Koala Bear'
];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a unique anonymous display name.
 * Checks the database to prevent duplicate active names.
 */
export async function generateUniqueIdentity() {
  let name = '';
  let attempts = 0;
  let isUnique = false;

  while (!isUnique && attempts < 50) {
    const adj = getRandomElement(ADJECTIVES);
    const noun = getRandomElement(NOUNS);
    
    // Avoid double words like "Arctic Arctic Fox"
    if (adj === 'Arctic' && noun === 'Arctic Fox') {
      name = 'Arctic Fox';
    } else {
      name = `${adj} ${noun}`;
    }

    // Check DB for collision
    const existing = await User.findOne({ displayName: name });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  // If still colliding after 50 attempts, append a random number
  if (!isUnique) {
    let finalName = '';
    while (!isUnique) {
      const adj = getRandomElement(ADJECTIVES);
      const noun = getRandomElement(NOUNS);
      const randNum = Math.floor(100 + Math.random() * 900); // 3-digit number
      finalName = `${adj} ${noun} ${randNum}`;
      
      const existing = await User.findOne({ displayName: finalName });
      if (!existing) {
        name = finalName;
        isUnique = true;
      }
    }
  }

  return name;
}
