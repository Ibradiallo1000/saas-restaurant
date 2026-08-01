import { redirect } from "next/navigation"

export default function LegacyCashierSessionPage() {
  redirect("/pos/sessions")
}
