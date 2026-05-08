"use client"

interface CloudinaryUploadResponse {
  secure_url?: string
  error?: {
    message?: string
  }
}

export async function uploadImage(file: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    throw new Error("Configuration Cloudinary manquante.")
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", uploadPreset)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  })
  const result = (await response.json()) as CloudinaryUploadResponse

  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || "Upload Cloudinary impossible.")
  }

  return result.secure_url
}
