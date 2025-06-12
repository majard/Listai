// hooks/useProduct.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { updateProduct, deleteProduct } from "../database/database";
import { Alert } from "react-native";

interface UseProductProps {
  productId: number;
  initialQuantity: number;
  // Optional: Callback to notify parent (e.g., the list) about a change.
  // For this scenario, useFocusEffect in HomeScreen already handles list reload,
  // but for more immediate feedback or complex scenarios, these could be useful.
  onQuantityUpdated?: (id: number, newQuantity: number) => void;
  onProductDeleted?: (id: number) => void;
}

const updateDebounceDelay = 300; // Debounce delay for single product DB updates
const initialContinuousDelay = 300; // Customizable delay for continuous adjustment
const intervalContinuousDelay = 100; // Customizable interval for continuous adjustment

export const useProduct = ({
  productId,
  initialQuantity,
  onQuantityUpdated,
  onProductDeleted,
}: UseProductProps) => {
  const [quantity, setQuantity] = useState(initialQuantity);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for debouncing single updates

  // --- Continuous Adjustment States and Refs ---
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustmentIncrement, setAdjustmentIncrement] = useState(false);
  const continuousAdjustmentIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const continuousAdjustmentInitialTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update internal quantity state if initialQuantity prop changes (e.g., from parent list reload)
  useEffect(() => {
    setQuantity(initialQuantity);
  }, [initialQuantity]);

  // --- Product Quantity Update Logic (Debounced for DB writes) ---
  const updateProductQuantity = useCallback(
    async (newQuantity: number) => {
      // Optimistic UI update
      setQuantity(newQuantity);
      if (onQuantityUpdated) {
        onQuantityUpdated(productId, newQuantity);
      }

      // Clear any previous debounced update for this product
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      // Set a new debounced update
      updateTimeoutRef.current = setTimeout(async () => {
        try {
          await updateProduct(productId, newQuantity);
        } catch (err) {
          console.error(`Erro ao atualizar produto ${productId}:`, err);
          // Optionally revert UI if DB update fails heavily, or trigger a full list reload
          // For now, rely on useFocusEffect in HomeScreen for eventual consistency.
        } finally {
          updateTimeoutRef.current = null;
        }
      }, updateDebounceDelay);
    },
    [productId, onQuantityUpdated]
  );

  // --- Continuous Quantity Adjustment Logic ---
  useEffect(() => {
    if (isAdjusting) {
      // Clear any existing timers just in case
      if (continuousAdjustmentInitialTimeoutRef.current) clearTimeout(continuousAdjustmentInitialTimeoutRef.current);
      if (continuousAdjustmentIntervalRef.current) clearInterval(continuousAdjustmentIntervalRef.current);

      continuousAdjustmentInitialTimeoutRef.current = setTimeout(() => {
        continuousAdjustmentIntervalRef.current = setInterval(() => {
          setQuantity((prevQuantity) => {
            const newQuantity = adjustmentIncrement
              ? prevQuantity + 1
              : Math.max(0, prevQuantity - 1);
            // Call the debounced update for the database
            updateProductQuantity(newQuantity);
            return newQuantity;
          });
        }, intervalContinuousDelay);
      }, initialContinuousDelay);
    }

    return () => {
      if (continuousAdjustmentInitialTimeoutRef.current) clearTimeout(continuousAdjustmentInitialTimeoutRef.current);
      if (continuousAdjustmentIntervalRef.current) clearInterval(continuousAdjustmentIntervalRef.current);
    };
  }, [isAdjusting, adjustmentIncrement, updateProductQuantity]);


  const startContinuousAdjustment = useCallback((increment: boolean) => {
    // Perform an immediate update on the initial press
    setQuantity((prevQuantity) => {
      const newQuantity = increment ? prevQuantity + 1 : Math.max(0, prevQuantity - 1);
      updateProductQuantity(newQuantity); // Debounced DB update
      return newQuantity;
    });

    setAdjustmentIncrement(increment);
    setIsAdjusting(true);
  }, [updateProductQuantity]);

  const stopContinuousAdjustment = useCallback(() => {
    setIsAdjusting(false);
    // Ensure any pending debounced updates from the continuous adjustment complete
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current); // Clear if it was part of a continuous chain
    }
  }, []);


  // --- Remove Product Logic ---
  const confirmRemoveProduct = useCallback(() => {
    Alert.alert(
      "Confirmar Exclusão",
      "Tem certeza que deseja excluir este produto?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProduct(productId);
              if (onProductDeleted) {
                onProductDeleted(productId);
              }
              // Parent list will re-load or filter out this product
            } catch (err) {
              console.error(`Erro ao deletar produto ${productId}:`, err);
              Alert.alert("Erro", "Não foi possível excluir o produto.");
            }
          },
        },
      ]
    );
  }, [productId, onProductDeleted]);

  return {
    quantity,
    updateProductQuantity,
    confirmRemoveProduct,
    startContinuousAdjustment,
    stopContinuousAdjustment,
  };
};