// Excel escapes embedded tabs/newlines with quotes and doubles literal quotes.
export function parseExcelClipboard(text: string): string[][] {
  const data: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false
  const input = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (char === '"' && quoted && input[index + 1] === '"') {
      value += '"'
      index += 1
    } else if (char === '"' && (quoted || value === '')) {
      quoted = !quoted
    } else if (!quoted && (char === '\t' || char === '\n')) {
      row.push(value)
      value = ''
      if (char === '\n') {
        data.push(row)
        row = []
      }
    } else value += char
  }
  if (quoted) throw new Error('Pasted text contains an unclosed quoted cell.')
  row.push(value)
  data.push(row)
  while (data.length && data[data.length - 1].every(cell => !cell.trim())) data.pop()
  return data
}
