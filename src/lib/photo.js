// Shrinks a picked photo to a small square JPEG so it can be stored with the player.
export function photoToDataUrl(file, size = 240) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      canvas
        .getContext('2d')
        .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL('image/jpeg', 0.78))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
