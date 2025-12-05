type MedalInput = {
  totalCorrect: number
  totalWrong: number
  totalSkipped: number
  durations: number[] // ms
  roundsPlayed: number
  roundsTotal: number
}

// PUBLIC_INTERFACE
export function computeMedals(inp: MedalInput): string[] {
  /**
   * Computes medals at tournament end:
   * - Bronze: complete all rounds
   * - Silver: accuracy ≥ 70%
   * - Gold: accuracy ≥ 85%
   * - Diamond: accuracy ≥ 95% and avg time per question ≤ 6s
   */
  const medals: string[] = []
  const totalAnswered = inp.totalCorrect + inp.totalWrong
  const denom = totalAnswered + inp.totalSkipped
  const accuracy = denom > 0 ? (inp.totalCorrect / (inp.totalCorrect + inp.totalWrong)) * 100 : 0

  if (inp.roundsPlayed >= inp.roundsTotal && inp.roundsTotal > 0) {
    medals.push('Bronze')
  }
  if (accuracy >= 70) medals.push('Silver')
  if (accuracy >= 85) medals.push('Gold')

  const avgMs =
    inp.durations && inp.durations.length
      ? inp.durations.reduce((a, b) => a + (isFinite(b) ? b : 0), 0) / inp.durations.filter(d => isFinite(d)).length
      : Number.POSITIVE_INFINITY
  if (accuracy >= 95 && avgMs <= 6000) {
    medals.push('Diamond')
  }
  return medals
}
