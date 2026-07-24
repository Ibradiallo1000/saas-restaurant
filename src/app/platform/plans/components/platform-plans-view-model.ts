export interface PlatformPlanTemplateSource { name: string; features: Record<string, boolean>; limits: Record<string, number> }
const featureLabels: Record<string, string> = { pos: "Caisse", analytics: "Analytics", multiUser: "Multi-utilisateur", ai: "Intelligence artificielle" }
const limitLabels: Record<string, string> = { maxUsers: "Utilisateurs maximum", maxOrdersPerMonth: "Commandes mensuelles maximum" }

export function buildPlatformPlanTemplateViewModel(key: string, template: PlatformPlanTemplateSource) {
  return { key, name: template.name, features: Object.entries(template.features).map(([id, enabled]) => ({ label: featureLabels[id] || id, enabled })), limits: Object.entries(template.limits).map(([id, value]) => ({ label: limitLabels[id] || id, value })) }
}

