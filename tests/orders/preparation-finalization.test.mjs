import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
import test from "node:test"
test("écran générique, redirection historique et listeners filtrés",async()=>{const [page,kitchen,reader,alert]=await Promise.all([readFile("src/app/(dashboard)/preparation/PreparationClient.tsx","utf8"),readFile("src/app/(dashboard)/kitchen/page.tsx","utf8"),readFile("src/modules/kitchen/canonical-read/firestore-reader.ts","utf8"),readFile("src/modules/preparation/PreparationIssuesAlert.tsx","utf8")]);assert.match(page,/preparationStationId/);assert.match(page,/stations\.length>1/);assert.match(kitchen,/redirect\("\/preparation"\)/);assert.match(reader,/preparationStationId/);assert.equal((alert.match(/useCollection/g)||[]).length,2)})
