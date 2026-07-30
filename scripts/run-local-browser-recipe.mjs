import { writeFile } from "node:fs/promises"

const browserPort = process.env.OORDERA_RECIPE_BROWSER_PORT ?? "9222"
const browserUrl = `http://127.0.0.1:${browserPort}`
const appUrl = "http://127.0.0.1:9002"

const targets = await fetch(`${browserUrl}/json/list`).then((response) => response.json())
const target = targets.find((entry) => entry.type === "page")
if (!target?.webSocketDebuggerUrl) throw new Error("No local Chrome page target found.")

const socket = new WebSocket(target.webSocketDebuggerUrl)
const pending = new Map()
let sequence = 0
const consoleErrors = []
const failedRequests = []

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data)
  if (message.id) {
    const waiter = pending.get(message.id)
    if (!waiter) return
    pending.delete(message.id)
    if (message.error) waiter.reject(new Error(message.error.message))
    else waiter.resolve(message.result)
    return
  }
  if (message.method === "Runtime.exceptionThrown") {
    consoleErrors.push(message.params.exceptionDetails.text)
  }
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    consoleErrors.push(message.params.entry.text)
  }
  if (message.method === "Network.loadingFailed") {
    failedRequests.push({
      url: message.params.url,
      errorText: message.params.errorText,
    })
  }
})

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true })
  socket.addEventListener("error", reject, { once: true })
})

await Promise.all([
  command("Page.enable"),
  command("Runtime.enable"),
  command("Network.enable"),
  command("Log.enable"),
])

if (process.env.OORDERA_RECIPE_TRACKING === "1") {
  await command("Page.reload", { ignoreCache: false })
  await waitFor(() => evaluate("document.readyState === 'complete'"), 20_000)
  await delay(3_000)
  const trackingCurrent = await snapshot("tracking-current")
  let trackingPayment
  let trackingReview
  if (process.env.OORDERA_RECIPE_REQUEST_PAYMENT === "1") {
    await clickButton("Espèces")
    await delay(2_000)
    trackingPayment = await snapshot("tracking-payment-requested")
  }
  if (process.env.OORDERA_RECIPE_SUBMIT_REVIEW === "1") {
    await clickButton("5 étoiles sur 5, Excellent")
    await clickButton("Oui")
    await clickButton("Envoyer mon avis")
    await delay(2_000)
    trackingReview = await snapshot("tracking-review-submitted")
  }
  console.log(JSON.stringify({
    trackingCurrent,
    trackingPayment,
    trackingReview,
    consoleErrors,
    failedRequests,
  }, null, 2))
  socket.close()
  process.exit(0)
}

if (process.env.OORDERA_RECIPE_PUBLIC_ONLY === "1") {
  if (process.env.OORDERA_RECIPE_RESET_LOCAL === "1") {
    await command("Network.clearBrowserCookies")
    await command("Storage.clearDataForOrigin", {
      origin: appUrl,
      storageTypes: "all",
    })
  }
  await navigate("/univers-food-local?t=demo-table")
  const publicMenu = await snapshot("public-menu")
  await clickButton("Découvrir le menu", false)
  await delay(1_500)
  const menuAfterCover = await snapshot("public-menu-after-cover")
  await clickButton("Ajouter")
  await clickButton("Bar")
  await delay(400)
  await clickButton("Ajouter")
  await clickButton("Service direct")
  await delay(400)
  await clickButton("Ajouter")
  await clickButton("Panier")
  await delay(500)
  const cart = await snapshot("public-cart")
  await clickButton("Continuer")
  await delay(500)
  const checkout = await snapshot("public-checkout")
  await evaluate(`
    (() => {
      const note = document.querySelector("textarea");
      if (!note) throw new Error("Checkout note not found");
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      ).set;
      setter.call(note, "Sans piment — recette locale");
      note.dispatchEvent(new Event("input", { bubbles: true }));
      note.dispatchEvent(new Event("change", { bubbles: true }));
    })()
  `)
  await clickButton("Valider la commande")
  await delay(4_000)
  const afterSubmit = await snapshot("public-after-submit")
  if (!await evaluate("location.pathname.startsWith('/order/')")) {
    console.log(JSON.stringify({ afterSubmit, consoleErrors, failedRequests }, null, 2))
  }
  await waitFor(() => evaluate("location.pathname.startsWith('/order/')"), 20_000)
  const tracking = await snapshot("public-tracking")
  await command("Page.reload", { ignoreCache: false })
  await waitFor(() => evaluate("document.readyState === 'complete'"), 20_000)
  await delay(1_000)
  const trackingAfterRefresh = await snapshot("public-tracking-refreshed")
  console.log(JSON.stringify({
    projectId: "demo-oordera-local",
    publicMenu,
    menuAfterCover,
    cart,
    checkout,
    tracking,
    trackingAfterRefresh,
    consoleErrors,
    failedRequests,
  }, null, 2))
  socket.close()
  process.exit(0)
}

if (process.env.OORDERA_RECIPE_RESET_LOCAL === "1") {
  await command("Network.clearBrowserCookies")
  await command("Storage.clearDataForOrigin", {
    origin: appUrl,
    storageTypes: "all",
  })
}
const staffEmail =
  process.env.OORDERA_RECIPE_STAFF_EMAIL ?? "cashier.local@example.test"
await navigate("/login")
const loginSnapshot = await snapshot("login")
await evaluate(`
  (() => {
    const email = document.querySelector('input[type="email"]');
    const password = document.querySelector('input[type="password"]');
    if (!email || !password) throw new Error("Login inputs not found");
    const setValue = (element, value) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      ).set;
      setter.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    };
    setValue(email, ${JSON.stringify(staffEmail)});
    setValue(password, "Password123!");
    const submit = [...document.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Se connecter"));
    if (!submit) throw new Error("Login submit not found");
    submit.click();
  })()
`)
await waitFor(() => evaluate("location.pathname !== '/login'"), 15_000)
const cashierLanding = await snapshot("cashier-landing")

if (process.env.OORDERA_RECIPE_KITCHEN === "1") {
  await navigate("/kitchen")
  const kitchenBefore = await snapshot("kitchen-before")
  await clickButton("Commencer", false)
  await waitFor(() => evaluate(`([...document.querySelectorAll("button")]
    .some((button) => button.textContent.toLowerCase().includes("prête")))`), 15_000)
  const kitchenPreparing = await snapshot("kitchen-preparing")
  await clickButton("Marquer prête")
  await delay(2_000)
  const kitchenReady = await snapshot("kitchen-ready")
  console.log(JSON.stringify({
    projectId: "demo-oordera-local",
    kitchenBefore,
    kitchenPreparing,
    kitchenReady,
    consoleErrors,
    failedRequests,
  }, null, 2))
  socket.close()
  process.exit(0)
}

await navigate("/pos")
const posSnapshot = await snapshot("pos")
if (process.env.OORDERA_RECIPE_POS_FLOW === "1") {
  await clickButton("Commandes")
  await delay(1_500)
  const posOrders = await snapshot("pos-orders")
  await clickButton("Voir détails", false)
  await delay(750)
  const posOrderDetail = await snapshot("pos-order-detail")
  let posAfterService
  let posPayment
  if (process.env.OORDERA_RECIPE_POS_COMPLETE === "1") {
    for (let index = 0; index < 3; index += 1) {
      if (!await clickButton("Marquer comme servi", false)) break
      await delay(2_000)
    }
    posAfterService = await snapshot("pos-after-service")
    await clickButton("Fermer", false)
    await delay(400)
    await clickButton("Encaisser session")
    await delay(750)
    posPayment = await snapshot("pos-payment")
  }
  console.log(JSON.stringify({
    projectId: "demo-oordera-local",
    posSnapshot,
    posOrders,
    posOrderDetail,
    posAfterService,
    posPayment,
    consoleErrors,
    failedRequests,
  }, null, 2))
  socket.close()
  process.exit(0)
}
await navigate("/pos/session")
const posSessionSnapshot = await snapshot("pos-session")

console.log(JSON.stringify({
  projectId: "demo-oordera-local",
  browser: target.description || "Chrome",
  login: loginSnapshot,
  cashierLanding,
  pos: posSnapshot,
  posSession: posSessionSnapshot,
  consoleErrors,
  failedRequests: failedRequests.filter(
    (entry) => !entry.url?.includes("fonts.googleapis.com") &&
      !entry.url?.includes("fonts.gstatic.com")
  ),
}, null, 2))

socket.close()

async function navigate(path) {
  if (!path.startsWith("/")) throw new Error("Only local relative paths are accepted.")
  await command("Page.navigate", { url: `${appUrl}${path}` })
  await waitFor(() => evaluate("document.readyState === 'complete'"), 20_000)
  await delay(1_000)
}

async function snapshot(label) {
  const state = await evaluate(`(() => ({
    url: location.href,
    title: document.title,
    viewport: { width: innerWidth, height: innerHeight },
    headings: [...document.querySelectorAll("h1,h2,h3")]
      .map((node) => node.textContent.trim()).filter(Boolean).slice(0, 20),
    buttons: [...document.querySelectorAll("button")]
      .map((node) => node.textContent.trim() || node.getAttribute("aria-label"))
      .filter(Boolean).slice(0, 30),
    text: document.body.innerText.replace(/\\s+/g, " ").trim().slice(0, 1500)
  }))()`)
  const screenshot = await command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  })
  const suffix = process.env.OORDERA_RECIPE_RUN_SUFFIX ?? ""
  await writeFile(
    `.local-recipe-${label}${suffix}.png`,
    Buffer.from(screenshot.data, "base64")
  )
  return state
}

async function clickButton(text, required = true) {
  const clicked = await evaluate(`(() => {
    const expected = ${JSON.stringify(text)};
    const button = [...document.querySelectorAll("button")]
      .find((candidate) => (candidate.textContent || candidate.getAttribute("aria-label") || "")
        .trim().toLowerCase().includes(expected.toLowerCase()));
    if (!button) return false;
    button.click();
    return true;
  })()`)
  if (!clicked && required) throw new Error(`Button not found: ${text}`)
  await delay(250)
  return clicked
}

async function waitFor(check, timeout) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await check()) return
    await delay(250)
  }
  throw new Error("Browser recipe timed out.")
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  }
  return result.result.value
}

function command(method, params = {}) {
  const id = ++sequence
  socket.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
