"use client"

import * as React from "react"

type Choice = {
  name: string
  price: number
}

type Option = {
  name: string
  required?: boolean
  choices: Choice[]
}

type Product = {
  name: string
  basePrice: number
  description?: string
  options?: Option[]
}

export default function ProductPreview({
  product,
  onChange
}: {
  product: Product
  onChange?: (data: {
    total: number
    selections: { [key: number]: number[] }
    isValid: boolean
  }) => void
}) {
  const [selectedOptions, setSelectedOptions] = React.useState<{
    [key: number]: number[]
  }>({})

  // 🔥 CALCUL PRIX
  const calculateTotal = (optionsState = selectedOptions) => {
    let total = product.basePrice

    Object.entries(optionsState).forEach(([optIndex, choiceIndexes]) => {
      const option = product.options?.[Number(optIndex)]

      choiceIndexes.forEach((choiceIndex) => {
        const choice = option?.choices[choiceIndex]
        total += Number(choice?.price || 0)
      })
    })

    return total
  }

  // 🔥 VALIDATION
  const isValid = React.useMemo(() => {
    if (!product.options) return true

    return product.options.every((opt, index) => {
      if (!opt.required) return true
      return selectedOptions[index]?.length > 0
    })
  }, [selectedOptions, product.options])

  // 🔥 HANDLE SELECT (SANS onChange ici)
  const handleSelect = (
    optIndex: number,
    choiceIndex: number,
    required?: boolean
  ) => {
    setSelectedOptions((prev) => {
      const current = prev[optIndex] || []

      if (required) {
        return {
          ...prev,
          [optIndex]: [choiceIndex]
        }
      }

      if (current.includes(choiceIndex)) {
        return {
          ...prev,
          [optIndex]: current.filter((i) => i !== choiceIndex)
        }
      }

      return {
        ...prev,
        [optIndex]: [...current, choiceIndex]
      }
    })
  }

  // 🔥 SYNC AVEC PARENT (BON PATTERN)
  React.useEffect(() => {
    if (!onChange) return

    onChange({
      total: calculateTotal(selectedOptions),
      selections: selectedOptions,
      isValid
    })
  }, [selectedOptions, isValid])

  const total = calculateTotal()

  return (
    <div className="space-y-4">

      {/* HEADER */}
      <div>
        <h2 className="text-lg font-bold">{product.name}</h2>
        {product.description && (
          <p className="text-sm text-muted-foreground">
            {product.description}
          </p>
        )}
      </div>

      {/* BASE PRICE */}
      <div className="text-sm">
        Prix de base :{" "}
        <span className="font-bold">{product.basePrice} FCFA</span>
      </div>

      {/* OPTIONS */}
      {product.options?.map((option, optIndex) => (
        <div key={optIndex} className="space-y-2">

          <h3 className="font-semibold text-sm">
            {option.name}
            {option.required && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </h3>

          <div className="flex flex-wrap gap-2">

            {option.choices.map((choice, choiceIndex) => {
              const isSelected =
                selectedOptions[optIndex]?.includes(choiceIndex)

              return (
                <button
                  key={choiceIndex}
                  onClick={() =>
                    handleSelect(optIndex, choiceIndex, option.required)
                  }
                  className={`px-3 py-2 border rounded-lg text-sm transition
                    ${
                      isSelected
                        ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                        : "hover:bg-muted"
                    }
                  `}
                >
                  {choice.name}
                  {choice.price > 0 && (
                    <span className="ml-2 text-xs">
                      +{choice.price}
                    </span>
                  )}
                </button>
              )
            })}

          </div>
        </div>
      ))}

      {/* TOTAL */}
      <div className="pt-4 border-t flex justify-between items-center">
        <span className="font-semibold">Total</span>
        <span className="text-lg font-bold text-[var(--color-primary)]">
          {total} FCFA
        </span>
      </div>

    </div>
  )
}
