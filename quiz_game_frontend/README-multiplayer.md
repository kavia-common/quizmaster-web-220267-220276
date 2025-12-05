# Multiplayer (Optional)

This frontend includes an optional multiplayer mode with a lobby and synchronized gameplay.

How it works:
- If `VITE_WS_URL` is set, the app will connect to the given WebSocket server for room creation, joining, ready state, start, submissions, and score updates.
- If `VITE_WS_URL` is not set, the UI shows a notice and offers a Local Demo mode that simulates two players in one tab with in-memory state.

Key features:
- Create/Join room with a short alphanumeric room code.
- Host picks a category and starts the round.
- All clients share the same questions via a shared seed.
- Fastest-correct scoring: first correct (+10), subsequent correct (+5), incorrect (0).
- Real-time leaderboard and per-question fastest indicator.
- Reconnection: if socket drops, the app tries to reconnect and rejoin using the saved room code and player id (persisted in localStorage).

Environment variable:
- VITE_WS_URL: e.g., `wss://example.com/ws`

Routes:
- `/multiplayer`: Lobby
- `/multiplayer/game`: Synchronized game view

Single-player:
- Unaffected. Continue to use Start page for single-player quizzes.
