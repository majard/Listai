import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Modal, Alert, ViewStyle, TextStyle, Pressable, Clipboard } from "react-native";
import { TextInput as PaperTextInput, Button, useTheme, Text, Card, IconButton, FAB, Menu, Divider } from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import { parse, isSameDay, parseISO } from "date-fns";
import { 
  getProducts, 
  Product, 
  updateProductQuantity, 
  saveProductHistoryForSingleProduct,
  deleteProduct,
  updateProduct,
  updateProductOrder,
  saveProductHistory,
  getProductHistory,
  addProduct,
  consolidateProductHistory
} from "../database/database";
import { findSimilarProducts } from "../utils/similarityUtils";
import { RootStackParamList } from "../types/navigation";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;

type Styles = {
  container: ViewStyle;
  header: ViewStyle;
  searchContainer: ViewStyle;
  searchInput: ViewStyle;
  buttonRow: ViewStyle;
  button: ViewStyle;
  buttonText: TextStyle;
  list: ViewStyle;
  card: ViewStyle;
  cardHeader: ViewStyle;
  dragHandle: ViewStyle;
  cardContent: ViewStyle;
  quantityContainer: ViewStyle;
  quantityButtons: ViewStyle;
  quantityInputContainer: ViewStyle;
  input: ViewStyle;
  cardActions: ViewStyle;
  fab: ViewStyle;
  modalOverlay: ViewStyle;
  modalContainer: ViewStyle;
  modalTitle: TextStyle;
  confirmationContent: ViewStyle;
  textInput: TextStyle;
  productInfo: ViewStyle;
  existingProduct: ViewStyle;
  similarProducts: ViewStyle;
  productLabel: TextStyle;
  productValue: TextStyle;
  modalButtonsContainer: ViewStyle;
  stackedButton: ViewStyle;
  actionButton: ViewStyle;
  buttonLabelStyle: TextStyle;
  skipButtonLabel: TextStyle;
  cancelButtonLabel: TextStyle;
  productCompareContainer: ViewStyle;
  productInfoColumn: ViewStyle;
  similarProductsScroll: ViewStyle;
  similarProductItem: ViewStyle;
  quantityText: TextStyle;
  dateText: TextStyle;
};

const getEmojiForProduct = (name: string): string => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("batata")) return "🥔";
  if (nameLower.includes("abóbora")) return "🎃";
  if (nameLower.includes("brócolis")) return "🥦";
  if (nameLower.includes("arroz")) return "🍚";
  if (nameLower.includes("risoto")) return "🍝";
  if (nameLower.includes("milho")) return "🌽";
  if (nameLower.includes("picadinho")) return "🍖";
  if (nameLower.includes("tropical")) return "🌴";
  if (nameLower.includes("panqueca")) return "🥞";
  if (nameLower.includes("waffle")) return "🧇";
  if (nameLower.includes("pão")) return "🍞";
  if (nameLower.includes("macarrão")) return "🍝";
  return "🍽️";
};

const similarityThreshold = 0.2; // Define your similarity threshold
const searchSimilarityThreshold = 0.4; // Define your similarity threshold

const commonOmittedWords = ["de", "do", "da", "e", "com"]; // Add more as needed

const preprocessName = (name: string): string => {
  return name
    .normalize("NFD") // Normalize to decompose combined characters
    .replace(/[\u0300-\u036f]/g, "") // R
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => !commonOmittedWords.includes(word))
    .join(" ");
};

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

export default function HomeScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustmentId, setAdjustmentId] = useState<number | null>(null);
  const [adjustmentIncrement, setAdjustmentIncrement] = useState(false);
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const route = useRoute();
  const theme = useTheme();
  const [isMounted, setIsMounted] = useState(true);
  const [sortOrder, setSortOrder] = useState<
    "custom" | "alphabetical" | "quantityAsc" | "quantityDesc"
  >("custom");
  const [menuVisible, setMenuVisible] = useState(false);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [importText, setImportText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [quantityTimeout, setQuantityTimeout] = useState<NodeJS.Timeout | null>(
    null
  );
  const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
  const [currentImportItem, setCurrentImportItem] = useState<{
    importedProduct: { originalName: string; quantity: number };
    bestMatch: Product | null;
    importDate: Date | null;
    remainingProducts: { originalName: string; quantity: number }[];
    similarProducts: Product[];
  } | null>(null);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const sortProducts = (productsToSort: Product[]) => {
    let sortedProducts = [...productsToSort];
    switch (sortOrder) {
      case "alphabetical":
        sortedProducts.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "quantityAsc":
        sortedProducts.sort((a, b) => a.quantity - b.quantity);
        break;
      case "quantityDesc":
        sortedProducts.sort((a, b) => b.quantity - a.quantity);
        break;
      default:
        sortedProducts.sort((a, b) => a.order - b.order);
        break;
    }
    return sortedProducts;
  };

  const loadProducts = async () => {
    try {
      const loadedProducts = await getProducts();
      if (isMounted) {
        setProducts(loadedProducts);
      }
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
    }
  };

  const handleImportButtonClick = () => {
    setIsImportModalVisible(true);
  };

  const handleImportModalImport = () => {
    importStockList(importText);
    setIsImportModalVisible(false);
    setImportText("");
  };

  const handleImportModalCancel = () => {
    setIsImportModalVisible(false);
    setImportText("");
  };

  useEffect(() => {
    const loadAndSortProducts = async () => {
      try {
        const loadedProducts = await getProducts();
        if (isMounted) {
          const sortedProducts = sortProducts(loadedProducts);
          setProducts([...sortedProducts]);
        }
      } catch (error) {
        console.error("Erro ao carregar produtos:", error);
      }
    };
    loadAndSortProducts();
  }, [sortOrder]);

  useEffect(() => {
    return () => {
      setIsMounted(false);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      const params = route.params as { shouldRefresh?: boolean };
      if (params?.shouldRefresh) {
        loadProducts();
        navigation.setParams({ shouldRefresh: false });
      }
    });
    return unsubscribe;
  }, [navigation, route.params]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isAdjusting && adjustmentId !== null) {
      const initialTimeout = setTimeout(() => {
        interval = setInterval(() => {
          setProducts((prevProducts) =>
            prevProducts.map((product) => {
              if (product.id === adjustmentId) {
                const newQuantity = adjustmentIncrement
                  ? product.quantity + 1
                  : Math.max(0, product.quantity - 1);
                updateProduct(adjustmentId, newQuantity).catch(console.error);
                return { ...product, quantity: newQuantity };
              }
              return product;
            })
          );
        }, 100);
      }, 300);
      return () => {
        clearTimeout(initialTimeout);
        if (interval) clearInterval(interval);
      };
    }
  }, [isAdjusting, adjustmentId, adjustmentIncrement]);

  const handleDelete = async (id: number) => {
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
              await deleteProduct(id);
              loadProducts();
            } catch (error) {
              console.error("Erro ao deletar produto:", error);
            }
          },
        },
      ]
    );
  };

  const handleQuantityInput = async (id: number, value: string) => {
    try {
      // Clear the previous timeout if it exists
      if (quantityTimeout) {
        clearTimeout(quantityTimeout);
      }

      if (value === "") {
        // Set a timeout to update to 0 after 200ms
        const timeoutId = setTimeout(async () => {
          await updateProduct(id, 0); // Update to 0 after the delay
          loadProducts(); // Reload products to reflect changes
        }, 200);
        setQuantityTimeout(timeoutId); // Store the timeout ID
        return;
      }

      const newQuantity = parseInt(value, 10);
      if (!isNaN(newQuantity) && newQuantity >= 0) {
        await updateProduct(id, newQuantity); // Update the product with the new quantity
        loadProducts(); // Reload products to reflect changes
      }
    } catch (error) {
      console.error("Erro ao atualizar quantidade:", error);
    }
  };

  // Use debounce for the quantity input handler
  const debouncedHandleQuantityInput = debounce(handleQuantityInput, 300);

  const handleQuantityChange = async (
    id: number,
    currentQuantity: number,
    increment: boolean
  ) => {
    try {
      const newQuantity = increment
        ? currentQuantity + 1
        : Math.max(0, currentQuantity - 1);
      await updateProduct(id, newQuantity);
      setProducts((prevProducts) =>
        prevProducts.map((product) =>
          product.id === id ? { ...product, quantity: newQuantity } : product
        )
      );
    } catch (error) {
      console.error("Erro ao atualizar quantidade:", error);
    }
  };

  const startContinuousAdjustment = (
    id: number,
    currentQuantity: number,
    increment: boolean
  ) => {
    handleQuantityChange(id, currentQuantity, increment);
    setAdjustmentId(id);
    setAdjustmentIncrement(increment);
    setIsAdjusting(true);
  };

  const stopContinuousAdjustment = () => {
    setIsAdjusting(false);
    setAdjustmentId(null);
  };

  const generateAndCopyStockList = async () => {
    try {
      await saveProductHistory();
      const today = new Date();
      const dateStr = today.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      let text = `Boa noite! ${dateStr}\n\n`;
      text += "Aqui está a lista de produção do dia:\n\n";
      products.forEach((product) => {
        const emoji = getEmojiForProduct(product.name);
        text += `- ${product.name}: ${product.quantity} ${emoji}\n`;
      });
      await Clipboard.setString(text);
    } catch (error) {
      console.error("Erro ao salvar histórico e copiar lista:", error);
    }
  };

  const handleDragEnd = async ({ data }: { data: Product[] }) => {
    try {
      setProducts(data);
      const updates = data.map((product, index) => ({
        id: product.id,
        order: index,
      }));
      await updateProductOrder(updates);
    } catch (error) {
      console.error("Erro ao reordenar produtos:", error);
      loadProducts();
    }
  };

  const calculateSimilarity = (name1: string, name2: string): number => {
    const set1 = new Set(name1.split(""));
    const set2 = new Set(name2.split(""));
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const commonLetters = intersection.size;
    const maxLength = Math.max(name1.length, name2.length);
    if (maxLength === 0) return 0;
    return commonLetters / maxLength; // Simple ratio of common letters
  };

  const parseImportDate = (lines: string[]): Date | null => {
    const dateFormats = ["dd/MM/yyyy", "dd/MM/yy", "dd/MM", "d/M"];
    const dateRegexes = [
      /(\d{2})\/(\d{2})\/(\d{4})/,
      /(\d{2})\/(\d{2})\/(\d{2})/,
      /(\d{2})\/(\d{2})/,
      /(\d{1,2})\/(\d{1,2})/,
    ];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    for (const line of lines) {
      for (let i = 0; i < dateFormats.length; i++) {
        const match = line.match(dateRegexes[i]);
        if (match) {
          try {
            // For single digit dates, pad with zeros for parsing
            const paddedLine = i === 3 
              ? `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}`
              : line;
            
            const format = i === 3 ? "dd/MM" : dateFormats[i];
            const parsedDate = parse(paddedLine, format, new Date());
            
            if (parsedDate && !isNaN(parsedDate.getTime())) {
              if (i === 2 || i === 3) {
                // For dd/MM or d/M format
                const day = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1; // Month is 0-indexed

                // Determine the correct year
                let assumedYear = currentYear;
                const parsedMonth = month + 1;
                if (
                  parsedMonth > currentMonth ||
                  (parsedMonth === currentMonth && day > currentDate.getDate())
                ) {
                  assumedYear--;
                }
                // Set time to 20:00
                return new Date(assumedYear, month, day, 20, 0, 0);
              }
              // Set time to 20:00 for all other date formats
              parsedDate.setHours(20, 0, 0, 0);
              return parsedDate;
            }
          } catch (error) {
            console.error('Error parsing date:', error);
          }
        }
      }
    }
    return null;
  };

  const parseImportProducts = (lines: string[]): { originalName: string; quantity: number }[] => {
    return lines
      .filter(line => line.trim()) // Remove empty lines
      .map(line => {
        // First, check if there are multiple numbers in the line
        const numbers = line.match(/\d+/g);
        if (!numbers || numbers.length === 0) return null; // No numbers = not a product
        if (numbers.length > 1) return null; // Multiple numbers = likely a date or something else
        
        const quantity = parseInt(numbers[0], 10);
        if (isNaN(quantity) || quantity <= 0) return null;

        // Remove the quantity and any special characters to get the product name
        const nameWithoutQuantity = line.replace(numbers[0], '');
        // Clean the name: remove special characters but keep spaces between words
        const cleanedName = nameWithoutQuantity
          .replace(/[-\/:_,;]/g, ' ') // Replace separators with spaces
          .replace(/\s+/g, ' ')       // Replace multiple spaces with single space
          .trim();                    // Remove leading/trailing spaces

        if (!cleanedName) return null;
        
        return {
          originalName: cleanedName,
          quantity
        };
      })
      .filter(item => item !== null);
  };

  const processNextProduct = async (
    remainingProducts: { originalName: string; quantity: number }[],
    importDate?: Date
  ) => {
    if (!remainingProducts || remainingProducts.length === 0) {
      setConfirmationModalVisible(false);
      setCurrentImportItem(null);
      await loadProducts();
      return;
    }

    const [currentProduct, ...rest] = remainingProducts;
    const existingProducts = await getProducts();
    
    // First, check for exact name matches (case-insensitive)
    const exactMatch = existingProducts.find(
      p => p.name.toLowerCase() === currentProduct.originalName.toLowerCase()
    );
    
    if (exactMatch) {
      // Update quantity and history of exact match
      await updateProductQuantity(exactMatch.id, currentProduct.quantity);
      if (importDate) {
        await saveProductHistoryForSingleProduct(
          exactMatch.id,
          currentProduct.quantity,
          importDate
        );
      }
      await processNextProduct(rest, importDate);
      return;
    }

    // If no exact match, look for similar products
    const similarProducts = findSimilarProducts(currentProduct.originalName, existingProducts);

    if (similarProducts.length > 0) {
      setCurrentImportItem({
        importedProduct: currentProduct,
        bestMatch: similarProducts[0],
        similarProducts,
        remainingProducts: rest,
        importDate,
      });
      setConfirmationModalVisible(true);
    } else {
      // No similar products found, create new product
      await createNewProduct(currentProduct, importDate);
      await processNextProduct(rest, importDate);
    }
  };

  const createNewProduct = async (
    product: { originalName: string; quantity: number },
    importDate?: Date
  ) => {
    try {
      // Check for exact name match again (case-insensitive)
      const existingProducts = await getProducts();
      const exactMatch = existingProducts.find(
        p => p.name.toLowerCase() === product.originalName.toLowerCase()
      );

      if (exactMatch) {
        // Update quantity of exact match
        await updateProductQuantity(exactMatch.id, product.quantity);
        return exactMatch.id;
      }

      // No exact match found, create new product
      const productId = await addProduct(product.originalName, product.quantity);
      
      if (importDate) {
        await saveProductHistoryForSingleProduct(
          productId,
          product.quantity,
          importDate
        );
      }
      
      return productId;
    } catch (error) {
      console.error('Error creating new product:', error);
      throw error;
    }
  };

  const importStockList = async (text: string) => {
    try {
      const lines = text.split("\n");
      const importDate = parseImportDate(lines);
      const importedProducts = parseImportProducts(lines);
      const existingProducts = await getProducts();

      await processNextProduct(importedProducts, importDate);
    } catch (error) {
      console.error("Error importing stock list:", error);
      Alert.alert("Erro", "Ocorreu um erro ao importar a lista.");
    }
  };

  const handleConfirmOverwrite = async () => {
    if (!currentImportItem) return;
    
    const { importedProduct, bestMatch, importDate, remainingProducts } = currentImportItem;
    const now = new Date();
    const historyDate = importDate ? importDate : now;

    // Get all history entries for this product
    const history = await getProductHistory(bestMatch.id.toString());
    
    if (history.length > 0) {
      // Sort history by date in descending order
      const sortedHistory = history.sort((a, b) => 
        parseISO(b.date).getTime() - parseISO(a.date).getTime()
      );
      
      const lastHistoryEntry = sortedHistory[0];
      const lastHistoryDate = parseISO(lastHistoryEntry.date);

      // If we have a history entry from the same day
      if (isSameDay(lastHistoryDate, historyDate)) {
        console.log(`Found existing history entry from ${lastHistoryEntry.date}`);
        setConfirmationModalVisible(false);
        await processNextProduct(remainingProducts);
        return;
      }

      // If the imported date is older than the last history entry, skip it
      if (historyDate < lastHistoryDate) {
        console.log(`Skipping older import from ${historyDate.toISOString()}`);
        setConfirmationModalVisible(false);
        await processNextProduct(remainingProducts);
        return;
      }
    }
    
    // If we get here, either:
    // 1. There's no history
    // 2. The imported date is newer than the last history entry
    // In both cases, we want to update the history and quantity
    await saveProductHistoryForSingleProduct(
      bestMatch.id,
      importedProduct.quantity,
      historyDate
    );
    
    await updateProduct(bestMatch.id, importedProduct.quantity);
    
    setConfirmationModalVisible(false);
    await processNextProduct(remainingProducts);
  };

  const handleAcceptAllSimilar = async () => {
    try {
      if (!currentImportItem?.bestMatch || !currentImportItem?.similarProducts) return;

      // Update all similar products to match the best match
      for (const product of currentImportItem.similarProducts.slice(1)) {
        await consolidateProductHistory(product.id, currentImportItem.bestMatch.id);
      }

      // Update the quantity of the best match
      await updateProductQuantity(
        currentImportItem.bestMatch.id,
        currentImportItem.importedProduct.quantity
      );

      setConfirmationModalVisible(false);
      await processNextProduct(currentImportItem.remainingProducts);
    } catch (error) {
      console.error('Error accepting all similar products:', error);
    }
  };

  const handleAcceptAllSuggestions = async () => {
    try {
      if (!currentImportItem) return;

      // Get all remaining products that have similar matches
      const productsToUpdate = currentImportItem.remainingProducts.filter(product => {
        const similarProducts = findSimilarProducts(product.originalName, products);
        return similarProducts.length > 0;
      });

      // Update all products
      for (const product of productsToUpdate) {
        const similarProducts = findSimilarProducts(product.originalName, products);
        if (similarProducts.length > 0) {
          const bestMatch = similarProducts[0];
          await updateProductQuantity(bestMatch.id, product.quantity);
        }
      }

      // Filter out the updated products and continue with the rest
      const remainingProducts = currentImportItem.remainingProducts.filter(product => {
        const similarProducts = findSimilarProducts(product.originalName, products);
        return similarProducts.length === 0;
      });

      setConfirmationModalVisible(false);
      await processNextProduct(remainingProducts);
    } catch (error) {
      console.error('Error accepting all suggestions:', error);
    }
  };

  const handleUpdateQuantityOnly = async () => {
    if (!currentImportItem?.bestMatch) return;

    try {
      const { bestMatch, importedProduct, importDate, remainingProducts } = currentImportItem;
      const now = new Date();
      const historyDate = importDate ? importDate : now;

      // Get all history entries for this product
      const history = await getProductHistory(bestMatch.id.toString());
      
      if (history.length > 0) {
        // Sort history by date in descending order
        const sortedHistory = history.sort((a, b) => 
          parseISO(b.date).getTime() - parseISO(a.date).getTime()
        );
        
        const lastHistoryEntry = sortedHistory[0];
        const lastHistoryDate = parseISO(lastHistoryEntry.date);

        // If we have a history entry from the same day or the import is older, skip it
        if (isSameDay(lastHistoryDate, historyDate) || historyDate < lastHistoryDate) {
          console.log(`Skipping update: ${historyDate < lastHistoryDate ? 'older import' : 'same day entry'}`);
          setConfirmationModalVisible(false);
          await processNextProduct(remainingProducts, importDate);
          return;
        }
      }

      // Only update if the date is newer than the last history entry
      await updateProductQuantity(bestMatch.id, importedProduct.quantity);
      await saveProductHistoryForSingleProduct(bestMatch.id, importedProduct.quantity, historyDate);

      setConfirmationModalVisible(false);
      await processNextProduct(remainingProducts, importDate);
    } catch (error) {
      console.error('Error updating product quantity:', error);
    }
  };

  const handleCreateNew = async () => {
    if (!currentImportItem) return;
    
    const { importedProduct, importDate, remainingProducts } = currentImportItem;
    await createNewProduct(importedProduct, importDate);
    
    setConfirmationModalVisible(false);
    await processNextProduct(remainingProducts);
  };

  const handleSkipImport = async () => {
    if (!currentImportItem) return;
    
    setConfirmationModalVisible(false);
    await processNextProduct(currentImportItem.remainingProducts);
  };

  const handleCancelAllImports = () => {
    setConfirmationModalVisible(false);
    setCurrentImportItem(null);
  };

  const ConfirmationModal = () => {
    if (!currentImportItem) return null;

    const { importedProduct, bestMatch, similarProducts, importDate } = currentImportItem;
    const [isNewerOrSameDate, setIsNewerOrSameDate] = useState(false);
    
    useEffect(() => {
      const checkHistory = async () => {
        const history = await getProductHistory(bestMatch.id.toString());
        if (history.length === 0) {
          setIsNewerOrSameDate(true);
          return;
        }

        const sortedHistory = history.sort((a, b) => 
          parseISO(b.date).getTime() - parseISO(a.date).getTime()
        );
        
        const lastHistoryDate = parseISO(sortedHistory[0].date);
        const historyDate = importDate || new Date();

        // Check if the import date is the same or newer than the last history entry
        setIsNewerOrSameDate(historyDate >= lastHistoryDate);
      };

      checkHistory();
    }, [bestMatch.id, importDate]);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    return (
      <Modal
        visible={confirmationModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfirmationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Produto Similar Encontrado</Text>
            <View style={styles.confirmationContent}>
              <View style={styles.productCompareContainer}>
                <View style={styles.productInfoColumn}>
                  <Text style={styles.productLabel}>Produto Importado:</Text>
                  <Text style={styles.productValue}>{importedProduct.originalName}</Text>
                  <Text style={styles.quantityText}>
                    Quantidade: {importedProduct.quantity}
                  </Text>
                  {importDate && (
                    <Text style={styles.dateText}>
                      Data: {formatDate(importDate)}
                    </Text>
                  )}
                </View>
                <View style={styles.productInfoColumn}>
                  <Text style={styles.productLabel}>Produto Existente:</Text>
                  <Text style={styles.productValue}>{bestMatch.name}</Text>
                  <Text style={styles.quantityText}>
                    Quantidade: {bestMatch.quantity}
                  </Text>
                </View>
              </View>
              <ScrollView style={styles.similarProductsScroll}>
                {similarProducts.slice(1).map((product, index) => (
                  <View key={index} style={styles.similarProductItem}>
                    <Text style={styles.productValue}>{product.name}</Text>
                    <Text style={styles.quantityText}>
                      Quantidade: {product.quantity}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
            <View style={styles.modalButtonsContainer}>
              <Button
                mode="contained"
                onPress={handleAcceptAllSimilar}
                style={[styles.stackedButton, styles.actionButton]}
                labelStyle={styles.buttonLabelStyle}
              >
                Aceitar Todas as Sugestões
              </Button>
              <Button
                mode="contained"
                onPress={handleUpdateQuantityOnly}
                style={[styles.stackedButton, styles.actionButton]}
                labelStyle={styles.buttonLabelStyle}
              >
                {isNewerOrSameDate ? 'Atualizar Quantidade' : 'Adicionar ao Histórico'}
              </Button>
              <Button
                mode="contained"
                onPress={handleCreateNew}
                style={[styles.stackedButton, styles.actionButton]}
                labelStyle={styles.buttonLabelStyle}
              >
                Criar Novo
              </Button>
              <Button
                mode="text"
                onPress={handleSkipImport}
                style={styles.stackedButton}
                labelStyle={[styles.buttonLabelStyle, styles.skipButtonLabel]}
              >
                Pular
              </Button>
              <Button
                mode="text"
                onPress={handleCancelAllImports}
                style={styles.stackedButton}
                labelStyle={[styles.buttonLabelStyle, styles.cancelButtonLabel]}
              >
                Cancelar Todos
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderItem = ({
    item,
    drag,
    isActive,
  }: {
    item: Product;
    drag: () => void;
    isActive: boolean;
  }) => {
    return (
      <ScaleDecorator>
        <Card style={[styles.card, { opacity: isActive ? 0.5 : 1 }]}>
          <Pressable
            onPress={() =>
              navigation.navigate("EditProduct", { product: item })
            }
            onLongPress={drag}
          >
            <Card.Content>
              <View style={styles.cardHeader}>
                <View style={styles.dragHandle}>
                  <Text variant="titleMedium">{item.name}</Text>
                </View>
                <View style={styles.cardActions}>
                  <IconButton
                    icon="pencil"
                    size={20}
                    onPress={() =>
                      navigation.navigate("EditProduct", { product: item })
                    }
                    iconColor={theme.colors.primary}
                  />
                  <IconButton
                    icon="delete"
                    size={20}
                    onPress={() => handleDelete(item.id)}
                    iconColor={theme.colors.error}
                  />
                </View>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.quantityContainer}>
                  <View style={styles.quantityInputContainer}>
                    <Text variant="bodyMedium">Quantidade: </Text>
                    <PaperTextInput
                      mode="outlined"
                      dense
                      value={item.quantity.toString()}
                      onChangeText={(value) =>
                        debouncedHandleQuantityInput(item.id, value)
                      }
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.quantityButtons}>
                    <IconButton
                      icon="minus"
                      size={20}
                      onPress={() =>
                        handleQuantityChange(item.id, item.quantity, false)
                      }
                      onLongPress={() =>
                        startContinuousAdjustment(item.id, item.quantity, false)
                      }
                      onPressOut={stopContinuousAdjustment}
                    />
                    <IconButton
                      icon="plus"
                      size={20}
                      onPress={() =>
                        handleQuantityChange(item.id, item.quantity, true)
                      }
                      onLongPress={() =>
                        startContinuousAdjustment(item.id, item.quantity, true)
                      }
                      onPressOut={stopContinuousAdjustment}
                    />
                  </View>
                </View>
              </View>
            </Card.Content>
          </Pressable>
        </Card>
      </ScaleDecorator>
    );
  };

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

  const styles = StyleSheet.create<Styles>({
    container: {
      flex: 1,
      backgroundColor: "#f5f5f5",
      paddingTop: 32,
      paddingBottom: 32,
    },
    header: {
      padding: 16,
      backgroundColor: "#fff",
      borderBottomWidth: 1,
      borderBottomColor: "#e0e0e0",
    },
    searchContainer: {
      marginBottom: 8,
    },
    searchInput: {
      height: 40,
      borderColor: "gray",
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 10,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    button: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      marginRight: 8,
    },
    buttonText: {
      fontSize: 12,
    },
    list: { 
      padding: 16, 
      paddingBottom: 160 
    },
    card: { 
      marginBottom: 16 
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    dragHandle: { 
      flexDirection: "row", 
      alignItems: "center" 
    },
    cardContent: { 
      marginTop: 8 
    },
    quantityContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    quantityButtons: { 
      flexDirection: "row" 
    },
    quantityInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    input: { 
      flex: 1, 
      marginHorizontal: 8 
    },
    cardActions: { 
      flexDirection: "row" 
    },
    fab: { 
      position: "absolute", 
      margin: 16, 
      right: 0, 
      bottom: 0 
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalContainer: {
      backgroundColor: "white",
      padding: 16,
      borderRadius: 12,
      width: '100%',
      maxHeight: '80%',
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 12,
      textAlign: "center",
      color: "#333",
    },
    confirmationContent: {
      marginBottom: 12,
      minHeight: 120,
      maxHeight: 300,
    },
    textInput: {
      borderWidth: 1,
      borderColor: "gray",
      borderRadius: 8,
      padding: 10,
      marginBottom: 16,
      backgroundColor: '#fff',
    },
    productInfo: {
      padding: 8,
      backgroundColor: "#f8f9fa",
      borderRadius: 8,
      marginBottom: 8,
    },
    existingProduct: {
      backgroundColor: "#e9ecef",
    },
    similarProducts: {
      marginTop: 8,
      padding: 12,
      backgroundColor: "#f8f9fa",
      borderRadius: 8,
    },
    similarProductItem: {
      fontSize: 14,
      color: "#666",
      marginTop: 4,
      marginLeft: 8,
    },
    productLabel: {
      fontSize: 12,
      color: "#666",
      marginBottom: 4,
    },
    productValue: {
      fontSize: 14,
      color: "#333",
      fontWeight: "500",
      marginBottom: 4,
    },
    quantityText: {
      fontSize: 12,
      color: "#666",
    },
    dateText: {
      fontSize: 12,
      color: '#666',
      marginTop: 4,
    },
    modalButtonsContainer: {
      gap: 4,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: '#eee',
    },
    stackedButton: {
      borderRadius: 8,
      height: 40,
      justifyContent: 'center',
    },
    actionButton: {
      marginBottom: 4,
    },
    buttonLabelStyle: {
      fontSize: 13,
    },
    skipButtonLabel: {
      color: "#666",
    },
    cancelButtonLabel: {
      color: "#dc3545",
    },
    productCompareContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      flex: 1,
    },
    productInfoColumn: {
      flex: 1,
      minHeight: 100,
    },
    similarProductsScroll: {
      flex: 1,
    },
    similarProductItem: {
      marginBottom: 8,
      padding: 8,
      backgroundColor: "#f8f9fa",
      borderRadius: 8,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <PaperTextInput
            placeholder="Pesquisar"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            mode="outlined"
            dense
          />
        </View>
        <View style={styles.buttonRow}>
          <Button
            mode="contained"
            onPress={generateAndCopyStockList}
            style={styles.button}
            icon="content-copy"
            labelStyle={styles.buttonText}
          >
            Salvar
          </Button>

          <Button
            mode="contained"
            onPress={handleImportButtonClick}
            icon="import"
            style={styles.button}
            labelStyle={styles.buttonText}
          >
            Importar
          </Button>

          <Menu
            visible={menuVisible}
            onDismiss={closeMenu}
            anchor={
              <Button
                icon="sort"
                onPress={openMenu}
                style={styles.button}
                labelStyle={styles.buttonText}
              >
                Ordenar
              </Button>
            }
          >
            <Menu.Item
              onPress={() => {
                setSortOrder("custom");
                closeMenu();
              }}
              title="Ordem Personalizada"
            />
            <Divider />
            <Menu.Item
              onPress={() => {
                setSortOrder("alphabetical");
                closeMenu();
              }}
              title="Alfabética"
            />
            <Divider />
            <Menu.Item
              onPress={() => {
                setSortOrder("quantityDesc");
                closeMenu();
              }}
              title="Quantidade (Maior Primeiro)"
            />
            <Divider />
            <Menu.Item
              onPress={() => {
                setSortOrder("quantityAsc");
                closeMenu();
              }}
              title="Quantidade (Menor Primeiro)"
            />
          </Menu>
        </View>
      </View>
      <DraggableFlatList
        data={filteredProducts}
        onDragEnd={handleDragEnd}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        extraData={products}
      />
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => navigation.navigate("AddProduct")}
        label="Adicionar Produto"
      />
      <View>
        <Modal
          visible={isImportModalVisible}
          onRequestClose={() => setIsImportModalVisible(false)}
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Importar Lista</Text>
              <PaperTextInput
                style={[styles.textInput, { height: 150, textAlignVertical: 'top' }]}
                multiline
                value={importText}
                onChangeText={setImportText}
                placeholder="Cole aqui sua lista de produtos"
                mode="outlined"
                dense
              />
              <View style={styles.buttonRow}>
                <Button
                  onPress={handleImportModalCancel}
                  style={styles.stackedButton}
                >
                  Cancelar
                </Button>
                <Button
                  onPress={handleImportModalImport}
                  style={styles.stackedButton}
                >
                  Importar
                </Button>
              </View>
            </View>
          </View>
        </Modal>

        <ConfirmationModal />
      </View>
    </SafeAreaView>
  );
}
