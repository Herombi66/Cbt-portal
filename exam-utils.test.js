
/**
 * Fisher-Yates shuffle implementation.
 */
export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Verifies that the shuffle produces non-identical orders.
 * Requirement: At least 100 shuffles produce non-identical order ≥ 95% of the time.
 */
export function verifyShuffleRandomness() {
  const original = Array.from({ length: 50 }, (_, i) => i);
  let nonIdenticalCount = 0;
  const iterations = 100;

  for (let i = 0; i < iterations; i++) {
    const shuffled = shuffle(original);
    if (JSON.stringify(shuffled) !== JSON.stringify(original)) {
      nonIdenticalCount++;
    }
  }

  const percentage = (nonIdenticalCount / iterations) * 100;
  console.log(`Shuffle randomness: ${percentage}%`);
  return percentage >= 95;
}

// Run test if this script is executed directly
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  const result = verifyShuffleRandomness();
  if (!result) {
    throw new Error('Shuffle randomness test failed');
  }
}
