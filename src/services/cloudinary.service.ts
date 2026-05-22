"use client"

interface CloudinaryUploadResponse {
  secure_url?: string
  error?: {
    message?: string
  }
}

export const uploadImage = async (file: File): Promise<string> => {
  const cloudinaryConfigured =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  // ✅ MODE DEV : preview local (convert to base64 to allow Firestore persistence)
  if (!cloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ✅ Upload réel
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  )

  const data = await res.json()

  if (!data.secure_url) {
    throw new Error("Upload échoué")
  }

  return data.secure_url
}
