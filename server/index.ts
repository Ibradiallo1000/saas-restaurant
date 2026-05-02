import "dotenv/config"

import { createRequire } from "node:module"

import { createRestaurantController } from "./controllers/create-restaurant.controller"

const require = createRequire(import.meta.url)
const express = require("express")

const app = express()
const port = Number(process.env.PORT ?? 3001)

app.use(express.json({ limit: "32kb" }))

app.get("/health", (_request: unknown, response: any) => {
  response.json({ ok: true })
})

app.post("/create-restaurant", createRestaurantController)
app.post("/api/create-restaurant", createRestaurantController)

app.listen(port, () => {
  console.log(`Onboarding API listening on http://localhost:${port}`)
})
