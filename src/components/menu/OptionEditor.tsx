"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"

export default function OptionEditor({ options, setOptions, inventoryItems = [] }: any) {

  const addOption = () => {
    setOptions([
      ...options,
      { name: "", required: false, multiple: false, choices: [] }
    ])
  }

  const updateOption = (index: number, field: string, value: any) => {
    const updated = [...options]
    updated[index][field] = value
    setOptions(updated)
  }

  const addChoice = (index: number) => {
    const updated = [...options]
    updated[index].choices.push({ name: "", price: 0, multiplier: 1, recipe: [] })
    setOptions(updated)
  }

  const updateChoice = (
    optIndex: number,
    choiceIndex: number,
    field: string,
    value: any
  ) => {
    const updated = [...options]
    updated[optIndex].choices[choiceIndex][field] = value
    setOptions(updated)
  }

  const removeOption = (index: number) => {
    const updated = options.filter((_: any, i: number) => i !== index)
    setOptions(updated)
  }

  const addRecipeLine = (optIndex: number, choiceIndex: number) => {
    const updated = [...options]
    const choice = updated[optIndex].choices[choiceIndex]
    choice.recipe = [
      ...(choice.recipe || []),
      { inventoryItemId: inventoryItems[0]?.id || "", quantity: 1 },
    ]
    setOptions(updated)
  }

  const updateRecipeLine = (
    optIndex: number,
    choiceIndex: number,
    lineIndex: number,
    field: "inventoryItemId" | "quantity",
    value: string | number
  ) => {
    const updated = [...options]
    const line = updated[optIndex].choices[choiceIndex].recipe[lineIndex]
    updated[optIndex].choices[choiceIndex].recipe[lineIndex] = {
      ...line,
      [field]: field === "quantity" ? Number(value) : value,
    }
    setOptions(updated)
  }

  const removeRecipeLine = (optIndex: number, choiceIndex: number, lineIndex: number) => {
    const updated = [...options]
    updated[optIndex].choices[choiceIndex].recipe = (updated[optIndex].choices[choiceIndex].recipe || [])
      .filter((_: any, index: number) => index !== lineIndex)
    setOptions(updated)
  }

  return (
    <div className="space-y-4">

      <h3 className="font-bold text-sm">Variantes du produit</h3>

      {options.map((opt: any, i: number) => (
        <div key={i} className="border p-4 rounded space-y-3">

          {/* HEADER OPTION */}
          <div className="flex gap-2">
            <Input
              placeholder="Nom (ex: Taille, Suppléments)"
              value={opt.name}
              onChange={(e) => updateOption(i, "name", e.target.value)}
            />

            <Button
              variant="destructive"
              size="icon"
              onClick={() => removeOption(i)}
            >
              <Trash2 size={16} />
            </Button>
          </div>

          {/* SETTINGS */}
          <div className="flex flex-col gap-2 text-sm">

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={opt.required}
                onChange={(e) => updateOption(i, "required", e.target.checked)}
              />
              Option obligatoire
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={opt.multiple || false}
                onChange={(e) => updateOption(i, "multiple", e.target.checked)}
              />
              Choix multiple (ex: suppléments)
            </label>

          </div>

          {/* CHOICES */}
          <div className="space-y-2">
            {opt.choices.map((choice: any, j: number) => (
              <div key={j} className="space-y-2 rounded-lg border bg-background p-2">
                <div className="grid gap-2 md:grid-cols-[1fr_120px_140px]">

                <Input
                  placeholder="Nom du choix (ex: Petite, Fromage)"
                  value={choice.name}
                  onChange={(e) =>
                    updateChoice(i, j, "name", e.target.value)
                  }
                />

                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Prix"
                  value={choice.price}
                  onChange={(e) =>
                    updateChoice(i, j, "price", Number(e.target.value))
                  }
                />

                <Input
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.1"
                  placeholder="Multiplicateur"
                  value={choice.multiplier ?? 1}
                  onChange={(e) =>
                    updateChoice(i, j, "multiplier", Number(e.target.value))
                  }
                />
                </div>

                <MultiplierHint multiplier={choice.multiplier ?? 1} />

                <div className="space-y-2 rounded-md bg-muted/40 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black uppercase text-muted-foreground">Impact stock optionnel</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={inventoryItems.length === 0}
                      onClick={() => addRecipeLine(i, j)}
                    >
                      Ajouter ingrédient
                    </Button>
                  </div>

                  {(choice.recipe || []).length > 0 ? (
                    <p className="text-xs font-bold text-orange-700">⚠️ Ce supplément consomme du stock</p>
                  ) : (
                    <p className="text-xs font-medium text-muted-foreground">ℹ️ Aucun impact sur le stock</p>
                  )}

                  {(choice.recipe || []).map((line: any, lineIndex: number) => (
                    <div key={lineIndex} className="grid gap-2 md:grid-cols-[1fr_120px_40px]">
                      <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={line.inventoryItemId || ""}
                        onChange={(event) => updateRecipeLine(i, j, lineIndex, "inventoryItemId", event.target.value)}
                      >
                        <option value="">Ingrédient</option>
                        {inventoryItems.map((item: any) => (
                          <option key={item.id} value={item.id}>
                            {item.name || "Ingrédient"}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min={0}
                        step="0.05"
                        value={line.quantity ?? ""}
                        onChange={(event) => updateRecipeLine(i, j, lineIndex, "quantity", event.target.value)}
                        placeholder="Qté"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeRecipeLine(i, j, lineIndex)}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <Button size="sm" onClick={() => addChoice(i)}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un choix
            </Button>
          </div>

        </div>
      ))}

      <Button variant="outline" onClick={addOption}>
        <Plus className="mr-2 h-4 w-4" />
        Ajouter une variante
      </Button>

    </div>
  )
}

function MultiplierHint({ multiplier }: { multiplier: unknown }) {
  const value = Number(multiplier ?? 1)

  if (!Number.isFinite(value) || value <= 0) {
    return <p className="text-xs font-bold text-red-700">⚠️ Multiplicateur invalide</p>
  }

  if (value > 5) {
    return <p className="text-xs font-bold text-red-700">⚠️ Maximum autorisé : 5</p>
  }

  return (
    <div className="space-y-1">
      {value === 1 ? (
        <p className="text-xs font-medium text-muted-foreground">ℹ️ Consommation normale</p>
      ) : value > 1 ? (
        <p className="text-xs font-bold text-orange-700">⚠️ Consomme {value}x les ingrédients</p>
      ) : (
        <p className="text-xs font-bold text-orange-700">⚠️ Consomme moins que la normale ({value}x)</p>
      )}

      {value > 3 && value <= 5 ? (
        <p className="text-xs font-bold text-orange-700">⚠️ Valeur élevée, vérifier</p>
      ) : null}
    </div>
  )
}
