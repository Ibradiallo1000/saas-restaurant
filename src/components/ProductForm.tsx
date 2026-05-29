import React, { useState, useEffect } from 'react';
import { getDefaultPreparationMode, PREPARATION_MODES, PreparationMode } from '@/utils/preparation-logic';

// Supposons que vous avez un type Product et Category
interface Product {
  id?: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  categoryName?: string; // Ajouté pour faciliter la démo, pourrait être joint de Firestore
  preparationMode: PreparationMode;
}

interface Category {
  id: string;
  name: string;
}

interface ProductFormProps {
  initialData?: Product;
  categories: Category[];
  onSubmit: (product: Product) => void;
  onCancel: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ initialData, categories, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Product>(
    initialData || {
      name: '',
      description: '',
      price: 0,
      categoryId: '',
      preparationMode: 'kitchen', // Valeur par défaut initiale
    }
  );

  // Mettre à jour la preparationMode par défaut si la catégorie change et que le mode n'a pas été défini manuellement
  useEffect(() => {
    if (formData.categoryId) {
      const selectedCategory = categories.find(cat => cat.id === formData.categoryId);
      if (selectedCategory && initialData?.preparationMode === undefined) { // Seulement si c'est un nouveau produit ou si le mode n'est pas déjà défini
        setFormData(prev => ({
          ...prev,
          preparationMode: getDefaultPreparationMode(selectedCategory.name),
        }));
      }
    }
  }, [formData.categoryId, categories, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const categoryId = e.target.value;
    const selectedCategory = categories.find(cat => cat.id === categoryId);
    
    setFormData(prev => ({
      ...prev,
      categoryId: categoryId,
      categoryName: selectedCategory?.name, // Stocke le nom pour la logique de fallback si besoin
      // Suggestion automatique du mode de préparation SI il n'a pas été défini ou si c'est un changement de catégorie pour un nouveau produit
      preparationMode: getDefaultPreparationMode(selectedCategory?.name || ''),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nom du produit</label>
        <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
        <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={3} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"></textarea>
      </div>
      <div>
        <label htmlFor="price" className="block text-sm font-medium text-gray-700">Prix</label>
        <input type="number" name="price" id="price" value={formData.price} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" step="0.01" required />
      </div>
      <div>
        <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700">Catégorie</label>
        <select name="categoryId" id="categoryId" value={formData.categoryId} onChange={handleCategoryChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required>
          <option value="">Sélectionnez une catégorie</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="preparationMode" className="block text-sm font-medium text-gray-700">Mode de traitement du produit</label>
        <select name="preparationMode" id="preparationMode" value={formData.preparationMode} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required>
          {PREPARATION_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>{mode.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Détermine si l'article est envoyé en cuisine, au bar, ou servi directement.
        </p>
      </div>
      <div className="flex justify-end space-x-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Annuler</button>
        <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">Enregistrer le produit</button>
      </div>
    </form>
  );
};

export default ProductForm;