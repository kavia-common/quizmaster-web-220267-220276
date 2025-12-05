# Tournament Mode

Play a structured 10-round tournament with increasing difficulty. Each round has 10 questions. Your score accumulates across rounds and medals are awarded based on overall performance.

How it works:
- Start at Tournament (Home → Tournament).
- Choose a category or Mixed.
- Play 10 rounds. Difficulty increases: [easy, easy, medium, medium, medium, hard, hard, hard, hard, hard].
- Auto-save and resume mid-tournament.
- Auto-next behavior inside each round mirrors Quiz mode (2s after explanation).
- Coins: +3 per completed round, +20 on tournament completion (idempotent via session keys).

Medals:
- Bronze: complete all 10 rounds.
- Silver: accuracy ≥ 70%.
- Gold: accuracy ≥ 85%.
- Diamond: accuracy ≥ 95% and average time per question ≤ 6s.

Accessibility:
- Live announcements for round transitions and medal awards.
- Semantic headings and clear buttons.

Tips:
- Enable Offline mode to use cached question packs.
- Use lifelines strategically.
- Aim for both accuracy and speed to secure Diamond!
