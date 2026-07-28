"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"

export default function OptionEditor({ options, setOptions }: any) {

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
    updated[index].choices.push({ name: "", price: 0 })
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
                <div className="grid gap-2 md:grid-cols-[1fr_140px]">

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
