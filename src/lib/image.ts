export function getOptimizedImage(url: string | null | undefined, width: number) {
  if (!url) return ""

  if (url.includes("res.cloudinary.com")) {
    const transform = `f_auto,q_auto,w_${width},c_fill`
    const [prefix, suffix] = url.split("/upload/")

    if (!suffix) return url

    const segments = suffix.split("/")
    const firstSegment = segments[0]
    const hasTransformSegment =
      firstSegment.includes(",") || firstSegment.includes("w_") || firstSegment.includes("q_")

    if (hasTransformSegment) {
      return `${prefix}/upload/${transform}/${segments.slice(1).join("/")}`
    }

    return `${prefix}/upload/${transform}/${suffix}`
  }

  return url
}
