export type DepletionLine = {
  mortalityTotal: number
  thinningTotal: number
  depletionTotal?: number
}

/** Shared with Flock Card Report; delivery is reported separately from depletion. */
export function getBroilerDepletionSummary(startingPopulation: number, lines: DepletionLine[]) {
  const totalMortality = lines.reduce((sum, line) => sum + line.mortalityTotal, 0)
  const totalThinning = lines.reduce((sum, line) => sum + line.thinningTotal, 0)
  const totalDepletion = totalMortality + totalThinning
  const cumulativeMortality = startingPopulation > 0 ? totalMortality / startingPopulation * 100 : 0
  const cumulativeDepletion = startingPopulation > 0 ? totalDepletion / startingPopulation * 100 : 0
  const recordedDepletion = lines.reduce((sum, line) =>
    sum + (line.depletionTotal ?? line.mortalityTotal + line.thinningTotal), 0)
  return {
    totalMortality, totalThinning, totalDepletion, cumulativeMortality, cumulativeDepletion,
    livability: Math.max(0, 100 - cumulativeDepletion),
    currentLiveBirds: Math.max(0, startingPopulation - recordedDepletion),
  }
}
