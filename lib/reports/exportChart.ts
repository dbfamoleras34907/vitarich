/** Resolve theme variables before serializing a chart outside its document. */
export async function exportChartPng(svg: SVGSVGElement, title: string, subtitle: string, legend: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const originals = [svg, ...svg.querySelectorAll('*')]
  const copies = [clone, ...clone.querySelectorAll('*')]
  for (let index = 0; index < originals.length; index++) {
    const style = getComputedStyle(originals[index])
    for (const property of ['fill', 'stroke', 'font-family', 'font-size', 'font-weight', 'opacity']) {
      copies[index].setAttribute(property, style.getPropertyValue(property))
    }
  }
  const width = svg.getBoundingClientRect().width
  const height = svg.getBoundingClientRect().height
  if (!width || !height) throw new Error('The chart is not ready to export.')
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(Math.max(width, 700) * 2)
    canvas.height = Math.ceil((height + 120) * 2)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image export is not supported in this browser.')
    context.scale(2, 2)
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = getComputedStyle(svg).color
    context.font = 'bold 18px sans-serif'
    context.fillText(title, 16, 27)
    context.font = '11px sans-serif'
    context.fillText(subtitle, 16, 48, canvas.width / 2 - 32)
    context.drawImage(image, 0, 62)
    context.fillText(legend, 16, height + 91, canvas.width / 2 - 32)
    const link = document.createElement('a')
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } finally { URL.revokeObjectURL(url) }
}
