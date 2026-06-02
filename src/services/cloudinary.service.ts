"use client"

interface CloudinaryUploadResponse {
  secure_url?: string
  error?: {
    message?: string
  }
}

export class CloudinaryConfigurationError extends Error {
  constructor() {
    super("Configuration Cloudinary manquante ou incomplete")
    this.name = "CloudinaryConfigurationError"
  }
}

const CLOUDINARY_PLACEHOLDERS = new Set([
  "...",
  "ton_cloud_name",
  "ton_unsigned_upload_preset",
  "your_cloud_name",
  "your_upload_preset",
  "abcd1234",
])

export const uploadImage = async (file: File): Promise<string> => {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim()
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim()
  const cloudinaryConfigured =
    cloudName &&
    uploadPreset &&
    !CLOUDINARY_PLACEHOLDERS.has(cloudName) &&
    !CLOUDINARY_PLACEHOLDERS.has(uploadPreset)

  // ✅ MODE DEV : preview local (convert to base64 to allow Firestore persistence)
  if (!cloudinaryConfigured) {
    throw new CloudinaryConfigurationError()
  }

  // ✅ Upload réel
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", uploadPreset!)

  let res: Response

  try {
    res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    )
  } catch (error) {
    throw new Error("Cloudinary inaccessible depuis le navigateur", { cause: error })
  }

  const data = (await res.json()) as CloudinaryUploadResponse

  if (!res.ok || !data.secure_url) {
    throw new Error(data.error?.message || "Upload Cloudinary echoue")
  }

  return data.secure_url
}
