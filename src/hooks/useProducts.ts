import { useState, useEffect, useCallback, useRef } from "react";
import { getProducts, updateProduct, deleteProduct, Product, updateProductOrder, saveProductHistory } from "../database/database"; // Added updateProductOrder
import { sortProducts, SortOrder } from "../utils/sortUtils";
import { preprocessName, calculateSimilarity } from "../utils/similarityUtils";
import { Alert } from "react-native"; // For confirm delete

const searchSimilarityThreshold = 0.4;

export default function useProducts(listId: number, sortOrder: SortOrder, searchQuery: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for debouncing single updates

  // --- Continuous Adjustment States and Refs ---
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustmentId, setAdjustmentId] = useState<number | null>(null);
  const [adjustmentIncrement, setAdjustmentIncrement] = useState(false);
  const continuousAdjustmentIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref for continuous adjustment interval
  const continuousAdjustmentInitialTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for initial delay
  const initialContinuousDelay = 300; // Customizable delay
  const intervalContinuousDelay = 100; // Customizable interval

  // --- Filtering Logic (memoized for performance) ---
  const filteredProducts = useCallback(() => {
    // Use useMemo to avoid re-calculation if products or searchQuery haven't changed
    const filtered = products.filter((product) => {
      const processedProductName = preprocessName(product.name);
      const processedSearchQuery = preprocessName(searchQuery);

      if (!processedSearchQuery) {
        return true;
      }

      const nameLength = processedProductName.length;
      const queryLength = processedSearchQuery.length;
      const lengthThreshold = Math.ceil(nameLength * 0.5);

      if (queryLength < lengthThreshold) {
        return processedProductName.includes(processedSearchQuery);
      }

      const similarity = calculateSimilarity(processedProductName, processedSearchQuery);
      return similarity >= searchSimilarityThreshold;
    });
    return sortProducts(filtered, sortOrder, searchQuery); // Apply sort after filtering
  }, [products, searchQuery, sortOrder]); // Dependencies for filteredProducts


  // --- Load Products Logic ---
  const loadProducts = useCallback(async () => {
    try {
      const loaded = await getProducts(listId);
      setProducts(loaded); // Set raw products, filtering/sorting done by filteredProducts memoized function
    } catch (err) {
      console.error("Erro ao carregar produtos:", err);
    }
  }, [listId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // --- Product Quantity Update Logic (Debounced for DB writes) ---
  const updateProductQuantity = useCallback(async (id: number, newQuantity: number) => {
    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, quantity: newQuantity } : p))
    );

    // Clear any previous debounced update for this product
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Set a new debounced update
    updateTimeoutRef.current = setTimeout(async () => {
      try {
        await updateProduct(id, newQuantity);
      } catch (err) {
        console.error("Erro ao atualizar produto:", err);
        // Optionally revert UI if DB update fails heavily
        // loadProducts();
      } finally {
        updateTimeoutRef.current = null;
      }
    }, 300); // Debounce delay for DB update
  }, []);

  // --- Continuous Quantity Adjustment Logic ---
  useEffect(() => {
    if (isAdjusting && adjustmentId !== null) {
      // Clear any existing timers just in case
      if (continuousAdjustmentInitialTimeoutRef.current) clearTimeout(continuousAdjustmentInitialTimeoutRef.current);
      if (continuousAdjustmentIntervalRef.current) clearInterval(continuousAdjustmentIntervalRef.current);

      continuousAdjustmentInitialTimeoutRef.current = setTimeout(() => {
        continuousAdjustmentIntervalRef.current = setInterval(() => {
          setProducts((prevProducts) => {
            const updatedProducts = prevProducts.map((product) => {
              if (product.id === adjustmentId) {
                const newQuantity = adjustmentIncrement
                  ? product.quantity + 1
                  : Math.max(0, product.quantity - 1);
                // Call the debounced update for the database
                updateProductQuantity(adjustmentId, newQuantity);
                return { ...product, quantity: newQuantity };
              }
              return product;
            });
            return updatedProducts;
          });
        }, intervalContinuousDelay);
      }, initialContinuousDelay);
    }

    return () => {
      if (continuousAdjustmentInitialTimeoutRef.current) clearTimeout(continuousAdjustmentInitialTimeoutRef.current);
      if (continuousAdjustmentIntervalRef.current) clearInterval(continuousAdjustmentIntervalRef.current);
    };
  }, [isAdjusting, adjustmentId, adjustmentIncrement, updateProductQuantity, initialContinuousDelay, intervalContinuousDelay]);


  const startContinuousAdjustment = useCallback((id: number, increment: boolean) => {
    // Perform an immediate update on the initial press
    setProducts((prevProducts) => {
      const updatedProducts = prevProducts.map((product) => {
        if (product.id === id) {
          const newQuantity = increment ? product.quantity + 1 : Math.max(0, product.quantity - 1);
          updateProductQuantity(id, newQuantity); // Debounced DB update
          return { ...product, quantity: newQuantity };
        }
        return product;
      });
      return updatedProducts;
    });

    setAdjustmentId(id);
    setAdjustmentIncrement(increment);
    setIsAdjusting(true);
  }, [updateProductQuantity]); // Depend on updateProductQuantity to ensure latest version

  const stopContinuousAdjustment = useCallback(() => {
    setIsAdjusting(false);
    setAdjustmentId(null);
    // Ensure any pending debounced updates from the continuous adjustment complete
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current); // Clear if it was part of a continuous chain
    }
  }, []);


  // --- Remove Product Logic ---
  const removeProduct = useCallback(async (id: number) => {
    try {
      await deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id)); // Optimistic UI update
      // No need to loadProducts again if UI is updated immediately
    } catch (err) {
      console.error("Erro ao deletar produto:", err);
      loadProducts(); // Reload from DB if update fails
    }
  }, []);

  const confirmRemoveProduct = useCallback((id: number) => {
    Alert.alert(
      "Confirmar Exclusão",
      "Tem certeza que deseja excluir este produto?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => removeProduct(id),
        },
      ]
    );
  }, [removeProduct]);


  // --- Product Order Handling Logic ---
  const handleProductOrderChange = useCallback(async ({data}: {data: Product[]}) => {
    setProducts(data); // Update UI immediately
    try {
      const updates = data.map((product, index) => ({
        id: product.id,
        order: index,
      }));
      await updateProductOrder(updates);
    } catch (error) {
      console.error("Erro ao reordenar produtos:", error);
      loadProducts(); // Reload from DB if update fails
    }
  }, [loadProducts]);

  return {
    products, // Keep products for DraggableFlatList extraData
    filteredProducts: filteredProducts(), // Call the memoized function
    setProducts,
    loadProducts,
    updateProductQuantity,
    confirmRemoveProduct,
    saveProductHistory,
    startContinuousAdjustment,
    stopContinuousAdjustment,
    handleProductOrderChange,
  };
}