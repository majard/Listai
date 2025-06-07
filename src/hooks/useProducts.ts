import { useState, useEffect, useCallback } from "react";
import {
  getProducts,
  updateProduct,
  deleteProduct,
  Product,
} from "../database/database";
import { calculateSimilarity, preprocessName } from "../utils/similarityUtils";

export default function useProducts(listId: number, sortOrder: string, searchQuery: string) {
  const [products, setProducts] = useState<Product[]>([]);

  const sortProducts = useCallback(
    (productsToSort: Product[]): Product[] => {
      let sorted = [...productsToSort];

      if (searchQuery.trim()) {
        const processedQuery = preprocessName(searchQuery);
        sorted.sort((a, b) => {
          const simA = calculateSimilarity(processedQuery, preprocessName(a.name));
          const simB = calculateSimilarity(processedQuery, preprocessName(b.name));
          return simB - simA;
        });
        return sorted;
      }

      switch (sortOrder) {
        case "alphabetical":
          sorted.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case "quantityAsc":
          sorted.sort((a, b) => a.quantity - b.quantity);
          break;
        case "quantityDesc":
          sorted.sort((a, b) => b.quantity - a.quantity);
          break;
        default:
          sorted.sort((a, b) => a.order - b.order);
          break;
      }

      return sorted;
    },
    [sortOrder, searchQuery]
  );

  const loadProducts = useCallback(async () => {
    try {
      const loaded = await getProducts(listId);
      setProducts(sortProducts(loaded));
    } catch (err) {
      console.error("Erro ao carregar produtos:", err);
    }
  }, [listId, sortProducts]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const updateQuantity = async (id: number, newQuantity: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, quantity: newQuantity } : p))
    );
    try {
      await updateProduct(id, newQuantity);
    } catch (err) {
      console.error("Erro ao atualizar produto:", err);
    }
  };

  const removeProduct = async (id: number) => {
    try {
      await deleteProduct(id);
      await loadProducts();
    } catch (err) {
      console.error("Erro ao deletar produto:", err);
    }
  };

  return {
    products,
    setProducts,
    loadProducts,
    updateQuantity,
    removeProduct,
  };
}
