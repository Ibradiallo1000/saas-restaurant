import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rules = readFileSync("firestore.rules", "utf8");

describe("restaurant location firestore rules", () => {
  it("protects platform geography writes behind super admin access", () => {
    assert.match(rules, /match \/platformCountries\/\{countryId\}/);
    assert.match(rules, /match \/cities\/\{cityId\}/);
    assert.match(rules, /match \/communes\/\{communeId\}/);
    assert.match(rules, /allow create: if isSuperAdmin\(\)/);
    assert.match(rules, /allow update: if isSuperAdmin\(\)/);
  });

  it("validates restaurant latitude and longitude bounds", () => {
    assert.match(rules, /lat >= -90/);
    assert.match(rules, /lat <= 90/);
    assert.match(rules, /lng >= -180/);
    assert.match(rules, /lng <= 180/);
  });

  it("requires structured location fields on restaurant creation", () => {
    assert.match(rules, /allow create: if isSuperAdmin\(\)\s*&& hasValidRestaurantLocationFields\(\);/);
    assert.match(rules, /hasValidRestaurantGeoLocation\(\)/);
    assert.match(rules, /hasValidRestaurantOpeningHoursUpdate\(\)/);
    assert.match(rules, /canManageRestaurantMenu\(restaurantId\)/);
  });
});
