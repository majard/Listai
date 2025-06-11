import { useState, useEffect, useCallback } from "react";
import {
  getProducts,
  updateProduct,
  deleteProduct,
  Product,
} from "../database/database";
import { sortProducts, SortOrder } from "../utils/sortUtils";
import { preprocessName, calculateSimilarity } from "../utils/similarityUtils";



const searchSimilarityThreshold = 0.4;

export default function useProducts(listId: number, sortOrder: SortOrder, searchQuery: string) {
  const [products, setProducts] = useState<Product[]>([]);

  
    const filteredProducts = products.filter((product) => {
      const processedProductName = preprocessName(product.name);
      const processedSearchQuery = preprocessName(searchQuery);
  
      // If search query is empty, return all products
      if (!processedSearchQuery) {
        return true;
      }
  
      // Calculate the length threshold
      const nameLength = processedProductName.length;
      const queryLength = processedSearchQuery.length;
      const lengthThreshold = Math.ceil(nameLength * 0.5); // 50% of the product name length
  
      // Use a simple substring match if the query is less than 50% of the product name length
      if (queryLength < lengthThreshold) {
        return processedProductName.includes(processedSearchQuery);
      }
  
      // Calculate similarity if the query meets the length requirement
      const similarity = calculateSimilarity(
        processedProductName,
        processedSearchQuery
      );
  
      return similarity >= searchSimilarityThreshold;
    });


  const loadProducts = useCallback(async () => {
    try {
      const loaded = await getProducts(listId);
      setProducts(sortProducts(loaded, sortOrder, searchQuery));
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
    filteredProducts,
    setProducts,
    loadProducts,
    updateQuantity,
    removeProduct,
  };
}
