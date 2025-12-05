# Coins System

A lightweight, persistent coin economy integrated across single-player, daily, and multiplayer game flows.

## Store

- Path: `src/stores/coins.ts`
- Persists to `localStorage` key `coins.v1`
- State: 
  - `balance: number`
  - `lifetimeEarned: number`
  - `history: Array<{ id: string; ts: number; delta: number; reason: 'correct-answer'|'quiz-complete'|'challenge-win'|'daily-complete'|'bonus'; meta?: Record<string,string|number> }>`
- Public API:
  - `load(), save(), reset()`
  - `add(delta, reason, id, meta?)` — idempotent (no duplicate awards for same id)
  - `spend(amount, id, meta?)` — optional, for future shop
  - Getters: `getBalance()`, `getHistory(limit?)`, `getLifetimeEarned()`
- Helpers:
  - `CoinIds.*` builders for consistent idempotency ids
  - `ensureCoinsLoaded()` to auto-load on first use

## Earning Rules (tunable)

See `COIN_RULES` in the store:
- `CORRECT_ANSWER = +2`
- `QUIZ_COMPLETE = +10`
- `DAILY_COMPLETE = +5`
- `MULTIPLAYER_WIN = +15`
- `PARTICIPATION = +3` (set to 0 to disable)

## Integration Points

- Single-player quiz (`src/stores/quiz.ts`):
  - On `submitAnswer` when correct: award `CORRECT_ANSWER` with id `sa:<sessionId>:<questionIndex>`
  - On quiz completion: award `QUIZ_COMPLETE` with id `qc:<sessionId>`
- Daily quiz (`src/stores/dailyQuiz.ts`):
  - On completion: award `DAILY_COMPLETE` with id `dc:<dailyId>`
- Multiplayer (`src/stores/multiplayer.ts`):
  - On round finalize: award winners `MULTIPLAYER_WIN` with id `mw:<roomCode>:<round>:<userId>`
  - Participation (if enabled): `mp:<roomCode>:<round>:<userId>`

All awards are idempotent; resuming or reloading will not double-award.

## UI

- Header badge (`components/QuizHeader.vue`): shows balance with accessible label and subtle +X animation (respects `prefers-reduced-motion`)
- Results (`views/ResultView.vue`): shows coins earned for the current session and updated balance
- Start (`views/StartView.vue`): shows current balance pill
- Multiplayer (`views/MultiplayerGameView.vue`): shows per-player coin awards inline after round ends

## Accessibility & Theme

- ARIA labels for status elements
- Ocean Professional colors:
  - primary `#2563EB`
  - coins accent `#F59E0B`
- Animations disabled for users preferring reduced motion

## Notes

- No new environment variables required.
- The store is standalone and compatible with offline usage.
