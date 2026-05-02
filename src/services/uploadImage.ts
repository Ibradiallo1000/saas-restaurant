export const uploadImage = async (file: File, restaurantId: string) => {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", "restaurant_upload")
  formData.append("folder", `restaurants/${restaurantId}/menu`)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/dwdvpz07g/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  )

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error?.message || "Upload failed")
  }

  return data
}