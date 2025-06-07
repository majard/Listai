import { useState, useEffect, useCallback } from "react";
import {
  getProducts,
  updateProduct,
  deleteProduct,
  Product,
} from "../database/database";
import { sortProducts, SortOrder } from "../utils/sortUtils";

export default function useProducts(listId: number, sortOrder: SortOrder, searchQuery: string) {
  const [products, setProducts] = useState<Product[]>([]);


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
    setProducts,
    loadProducts,
    updateQuantity,
    removeProduct,
  };
}
