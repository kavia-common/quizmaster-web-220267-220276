import type { QuizQuestion, CategoryKey } from '@/stores/quiz'

/**
 * Local fallback pools for deterministic selection when offline/no backend.
 * Keep in sync with quiz.ts fallbackPools; minimal set for examples.
 */
const pools: Record<CategoryKey, QuizQuestion[]> = {
  gk: [
    { id: 'gk-1', question: 'What is the capital of France?', options: ['Madrid', 'Paris', 'Berlin', 'Rome'], answerIndex: 1, explanation: 'Paris is the capital and most populous city of France.', source: 'Wikipedia', referenceUrl: 'https://en.wikipedia.org/wiki/Paris', hint: 'It is nicknamed the City of Light.' },
    { id: 'gk-2', question: 'What is 9 + 10?', options: ['18', '19', '20'], answerIndex: 1, explanation: 'Basic arithmetic: 9 + 10 equals 19.', hint: 'Think one more than 18.' },
    { id: 'gk-3', question: 'Which language runs in a web browser?', options: ['Java', 'C', 'Python', 'JavaScript'], answerIndex: 3, explanation: 'JavaScript is the standard language for client-side web development.', hint: 'It’s the language of the DOM.' },
  ],
  sports: [
    { id: 'sp-1', question: 'How many players in a football (soccer) team on the field?', options: ['9', '10', '11', '12'], answerIndex: 2, explanation: 'A standard soccer team fields 11 players, including the goalkeeper.', hint: 'It’s a number between 10 and 12.' },
    { id: 'sp-2', question: 'In tennis, what is 0 points called?', options: ['Null', 'Love', 'Zero', 'Nil'], answerIndex: 1, explanation: 'In tennis scoring, “love” means zero.', hint: 'A four-letter word that sounds romantic.' },
    { id: 'sp-3', question: 'Which country hosts the Tour de France?', options: ['Italy', 'France', 'Spain', 'Belgium'], answerIndex: 1, explanation: 'The Tour de France is primarily held in France.', hint: 'It’s in the event name.' },
  ],
  movies: [
    { id: 'mv-1', question: 'Who directed Inception?', options: ['Steven Spielberg', 'Christopher Nolan', 'James Cameron', 'Ridley Scott'], answerIndex: 1, explanation: 'Christopher Nolan wrote and directed Inception (2010).', hint: 'He also directed The Dark Knight.' },
    { id: 'mv-2', question: 'The Hobbit is set in which world?', options: ['Narnia', 'Earthsea', 'Middle-earth', 'Westeros'], answerIndex: 2, explanation: 'Middle-earth is the fictional setting of Tolkien’s legendarium.', hint: 'Think Tolkien.' },
    { id: 'mv-3', question: 'Which film features a DeLorean time machine?', options: ['Back to the Future', 'Terminator', 'Looper', 'Primer'], answerIndex: 0, explanation: 'Back to the Future popularized the DeLorean as a time machine.', hint: 'Great Scott!' },
  ],
  science: [
    { id: 'sc-1', question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Saturn', 'Mars', 'Jupiter'], answerIndex: 2, explanation: 'Mars appears reddish due to iron oxide (rust) on its surface.', hint: 'Named after the Roman god of war.' },
    { id: 'sc-2', question: 'H2O is the chemical formula for?', options: ['Hydrogen', 'Oxygen', 'Water', 'Helium'], answerIndex: 2, explanation: 'Two hydrogen atoms bonded to one oxygen atom makes water.', hint: 'It’s essential for life.' },
    { id: 'sc-3', question: 'Speed of light is approximately?', options: ['3x10^8 m/s', '3x10^6 m/s', '30000 km/s', '3x10^10 m/s'], answerIndex: 0, explanation: 'In vacuum, light speed is around 3 × 10^8 m/s.', hint: 'Roughly 300,000 km/s.' },
  ],
  history: [
    { id: 'hs-1', question: 'Who painted the Mona Lisa?', options: ['Picasso', 'Da Vinci', 'Van Gogh'], answerIndex: 1, explanation: 'Leonardo da Vinci painted the Mona Lisa.', hint: 'His first name is Leonardo.' },
    { id: 'hs-2', question: 'The pyramids are located in which country?', options: ['Peru', 'Egypt', 'Mexico', 'China'], answerIndex: 1, explanation: 'The most famous pyramids are in Egypt.', hint: 'Home to the Nile delta.' },
    { id: 'hs-3', question: 'World War II ended in which year?', options: ['1943', '1944', '1945', '1946'], answerIndex: 2, explanation: 'WWII ended in 1945.', hint: 'Mid-1940s.' },
  ],
  geography: [
    { id: 'ge-1', question: 'Which is the largest ocean?', options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'], answerIndex: 2, explanation: 'The Pacific is the largest ocean.', hint: 'Its name suggests calmness.' },
    { id: 'ge-2', question: 'Mount Everest is in which mountain range?', options: ['Andes', 'Himalayas', 'Alps', 'Rockies'], answerIndex: 1, explanation: 'Everest is part of the Himalayas.', hint: 'Range spans Nepal and Tibet.' },
    { id: 'ge-3', question: 'The Nile river flows into which sea?', options: ['Black Sea', 'Red Sea', 'Mediterranean Sea', 'Arabian Sea'], answerIndex: 2, explanation: 'The Nile empties into the Mediterranean Sea.', hint: 'The sea north of Africa.' },
  ],
}

export default pools

function seededHash(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) || 1
}
function makeRng(seedNum: number) {
  let s = seedNum >>> 0
  return function next(): number {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 0xffffffff
  }
}
function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}


// PUBLIC_INTERFACE
export function getDailyQuestionSet(seed: string, count = 10, category?: CategoryKey | null): QuizQuestion[] {
  /** Deterministically select a set of questions from pools using a seed.
   * If category provided, pick from that category; otherwise from all.
   */
  const seedNum = seededHash(seed)
  const rng = makeRng(seedNum)
  const src = category ? (pools[category] ?? []) : Object.values(pools).flat()
  if (!src.length) return []
  const idx = src.map((_, i) => i)
  shuffleInPlace(idx, rng)
  return idx.slice(0, Math.min(count, idx.length)).map(i => src[i])
}

// PUBLIC_INTERFACE
export function getTournamentQuestionSet(
  seed: string,
  category: CategoryKey | undefined,
  difficulty: 'easy' | 'medium' | 'hard',
  countPerRound = 10
): QuizQuestion[] {
  /**
   * Deterministic selector for tournament rounds using a seed + difficulty.
   * If pools have difficulty metadata in future, filter accordingly.
   * For now, simulate difficulty by taking earlier indices (easy), mid (medium), later (hard).
   */
  const fullPool = category ? (pools[category] ?? []) : Object.values(pools).flat()
  if (!fullPool.length) return []
  const seedNum = seededHash(`${seed}:${difficulty}`)
  const rng = makeRng(seedNum)

  // Simulate difficulty by slicing ranges
  const n = fullPool.length
  let start = 0
  let end = n
  if (difficulty === 'easy') {
    start = 0
    end = Math.max(1, Math.floor(n * 0.4))
  } else if (difficulty === 'medium') {
    start = Math.floor(n * 0.2)
    end = Math.max(start + 1, Math.floor(n * 0.75))
  } else {
    start = Math.floor(n * 0.5)
    end = n
  }
  const sub = fullPool.slice(start, end)
  if (!sub.length) return []

  const idx = sub.map((_, i) => i)
  shuffleInPlace(idx, rng)
  const picked = idx.slice(0, Math.min(countPerRound, idx.length)).map(i => sub[i])
  // Ensure deterministic order by shuffling picked again with same seed to keep predictable arrangement
  const arr = [...picked]
  shuffleInPlace(arr, rng)
  return arr
}
