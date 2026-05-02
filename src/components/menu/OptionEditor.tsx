"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"

export default function OptionEditor({ options, setOptions }: any) {

  const addOption = () => {
    setOptions([
      ...options,
      { name: "", required: false, choices: [] }
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

  const updateChoice = (optIndex: number, choiceIndex: number, field: string, value: any) => {
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

      <h3 className="font-bold text-sm">Options</h3>

      {options.map((opt: any, i: number) => (
        <div key={i} className="border p-4 rounded space-y-3">

          <div className="flex gap-2">
            <Input
              placeholder="Nom (ex: Taille)"
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

          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={opt.required}
              onChange={(e) => updateOption(i, "required", e.target.checked)}
            />
            Option obligatoire
          </label>

          {/* CHOICES */}
          <div className="space-y-2">
            {opt.choices.map((choice: any, j: number) => (
              <div key={j} className="flex gap-2">

                <Input
                  placeholder="Choix"
                  value={choice.name}
                  onChange={(e) =>
                    updateChoice(i, j, "name", e.target.value)
                  }
                />

                <Input
                  type="number"
                  placeholder="+ prix"
                  value={choice.price}
                  onChange={(e) =>
                    updateChoice(i, j, "price", Number(e.target.value))
                  }
                />

              </div>
            ))}

            <Button size="sm" onClick={() => addChoice(i)}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter choix
            </Button>
          </div>

        </div>
      ))}

      <Button variant="outline" onClick={addOption}>
        <Plus className="mr-2 h-4 w-4" />
        Ajouter option
      </Button>

    </div>
  )
}