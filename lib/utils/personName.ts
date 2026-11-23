/** Display a person's name with each word capitalized and remaining letters lowercase. */
export function formatPersonName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, boundary: string, letter: string) =>
      `${boundary}${letter.toLocaleUpperCase()}`,
    )
}
