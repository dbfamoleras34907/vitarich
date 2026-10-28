export function formatNumberRanges(values: number[]) {
  const sorted = [...new Set(values)].sort((left, right) => left - right)
  const ranges: string[] = []

  for (let index = 0; index < sorted.length; index += 1) {
    const start = sorted[index]
    let end = start
    while (index + 1 < sorted.length && sorted[index + 1] === end + 1) {
      end = sorted[index + 1]
      index += 1
    }
    ranges.push(start === end ? String(start) : `${start}–${end}`)
  }

  return ranges.join(', ')
}

