"use client"

interface CloudinaryUploadResponse {
  secure_url?: string
  public_id?: string
  format?: string
  width?: number
  height?: number
  error?: {
    message?: string
  }
}

export type CloudinaryUploadResult = {
  url: string
  secureUrl: string
  publicId: string
  format?: string
  width?: number
  height?: number
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

export const uploadImage = async (file: File): Promise<CloudinaryUploadResult> => {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim()
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim()
  const folder = process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER?.trim()
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
  if (folder) {
    formData.append("folder", folder)
  }

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

  return {
    url: data.secure_url,
    secureUrl: data.secure_url,
    publicId: data.public_id || "",
    format: data.format,
    width: data.width,
    height: data.height,
  }
}
