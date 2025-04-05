import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Clipboard,
  Pressable,
  Alert,
  SafeAreaView,
  ScrollView,
  ViewStyle,
  TextStyle,
  Modal,
} from "react-native";
import {
  FAB,
  Card,
  Text,
  IconButton,
  useTheme,
  Button,
  Menu,
  Divider,
  TextInput as PaperTextInput,
} from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import DraggableFlatList, {
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import {
  Product,
  getProducts,
  deleteProduct,
  updateProduct,
  updateProductOrder,
  saveProductHistory,
  getProductHistory,
  createProduct,
  saveProductHistoryForSingleProduct,
  addProduct,
  QuantityHistory,
} from "../database/database";
import { RootStackParamList } from "../types/navigation";
import { parse, isSameDay, parseISO, isBefore } from "date-fns";
import { updateProductQuantity } from "../database/database";
import { findSimilarProducts } from "../utils/similarityUtils";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;

type StyleSheet = {
  container: ViewStyle;
  header: ViewStyle;
  searchContainer: ViewStyle;
  searchInput: ViewStyle;
  buttonRow: ViewStyle;
  button: ViewStyle;
  buttonLabel: TextStyle;
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
  textInput: ViewStyle;
  productInfo: ViewStyle;
  existingProduct: ViewStyle;
  similarProducts: ViewStyle;
  similarProductItem: TextStyle;
  productLabel: TextStyle;
  productValue: TextStyle;
  modalButtonsStacked: ViewStyle;
  stackedButton: ViewStyle;
  cancelButtonLabel: TextStyle;
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

const similarityThreshold = 0.6; // Define your similarity threshold
const searchSimilarityThreshold = 0.5; // Define your similarity threshold

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
    const dateFormats = ["dd/MM/yyyy", "dd/MM/yy", "dd/MM"];
    const dateRegexes = [
      /(\d{2})\/(\d{2})\/(\d{4})/,
      /(\d{2})\/(\d{2})\/(\d{2})/,
      /(\d{2})\/(\d{2})/,
    ];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    for (const line of lines) {
      for (let i = 0; i < dateFormats.length; i++) {
        const match = line.match(dateRegexes[i]);
        if (match) {
          const format = dateFormats[i];
          const dateString = match[0]; // Extract the matched date string
          const parsedDate = parse(dateString, format, new Date());

          if (!isNaN(parsedDate.getTime())) {
            if (format === "dd/MM") {
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
              return new Date(assumedYear, month, day);
            }
            return parsedDate;
          }
        }
      }
    }
    return null;
  };

  const parseImportProducts = (
    lines: string[]
  ): { originalName: string; quantity: number }[] => {
    const productRegex = /- (.+): (\d+) /;
    const products: { originalName: string; quantity: number }[] = [];
    for (const line of lines) {
      const productMatch = line.match(productRegex);
      if (productMatch) {
        const originalName = productMatch[1].trim();
        const quantity = parseInt(productMatch[2], 10);
        products.push({ originalName, quantity });
      }
    }
    return products;
  };

  const processNextProduct = async (
    remainingProducts: { originalName: string; quantity: number }[],
    importDate: Date | null = null,
    existingProducts: Product[] = []
  ) => {
    if (remainingProducts.length === 0) {
      await loadProducts();
      return;
    }

    const importedProduct = remainingProducts[0];
    const processedImportName = preprocessName(importedProduct.originalName);
    let potentialMatches: { product: Product; similarity: number }[] = [];

    for (const existingProduct of existingProducts) {
      // If names are exactly the same (case-insensitive), auto-update without asking
      if (existingProduct.name.toLowerCase() === importedProduct.originalName.toLowerCase()) {
        const now = new Date();
        const historyDate = importDate ? importDate : now;
        await saveProductHistoryForSingleProduct(
          existingProduct.id,
          importedProduct.quantity,
          historyDate
        );
        await updateProduct(existingProduct.id, importedProduct.quantity);
        await processNextProduct(remainingProducts.slice(1), importDate, existingProducts);
        return;
      }

      const processedExistingName = preprocessName(existingProduct.name);
      const similarity = calculateSimilarity(
        processedImportName,
        processedExistingName
      );

      if (similarity >= similarityThreshold) {
        potentialMatches.push({ product: existingProduct, similarity });
      }
    }

    if (potentialMatches.length > 0) {
      // Sort matches by similarity
      potentialMatches.sort((a, b) => b.similarity - a.similarity);
      
      setCurrentImportItem({
        importedProduct,
        bestMatch: potentialMatches[0].product,
        importDate,
        remainingProducts: remainingProducts.slice(1),
        similarProducts: potentialMatches.map(m => m.product)
      });
      setConfirmationModalVisible(true);
      return;
    }

    // If no match or no confirmation needed, create new product
    await createNewProduct(importedProduct, importDate);
    await processNextProduct(remainingProducts.slice(1), importDate, existingProducts);
  };

  const importStockList = async (text: string) => {
    try {
      const lines = text.split("\n");
      const importDate = parseImportDate(lines);
      const importedProducts = parseImportProducts(lines);
      const existingProducts = await getProducts();

      await processNextProduct(importedProducts, importDate, existingProducts);
    } catch (error) {
      console.error("Error importing stock list:", error);
      Alert.alert("Erro", "Ocorreu um erro ao importar a lista.");
    }
  };

  const createNewProduct = async (
    importedProduct: { originalName: string; quantity: number },
    importDate: Date | null
  ) => {
    const now = new Date();
    console.log(`Creating new product: "${importedProduct.originalName}"`);
    const newProductId = await addProduct(
      importedProduct.originalName,
      importedProduct.quantity
    );
    if (importDate && !isBefore(importDate, now)) {
      console.log(
        `Skipping history save for new product "${importedProduct.originalName}" as import date is in the future.`
      );
    } else {
      const historyDate = importDate ? importDate : now;
      await saveProductHistoryForSingleProduct(
        newProductId,
        importedProduct.quantity,
        historyDate
      );
    }
  };

  const handleConfirmOverwrite = async () => {
    if (!currentImportItem) return;
    
    const { importedProduct, bestMatch, importDate, remainingProducts } = currentImportItem;
    const now = new Date();
    const historyDate = importDate ? importDate : now;

    // Get all history entries for this product
    const history = await getProductHistory(bestMatch.id.toString());
    
    // Delete all entries from the same day as the import
    for (const entry of history) {
      const entryDate = parseISO(entry.date);
      if (isSameDay(entryDate, historyDate)) {
        // Here we would need a function to delete the history entry
        // For now, we'll just overwrite with the new value
        console.log(`Overwriting history entry from ${entry.date}`);
      }
    }
    
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
    if (!currentImportItem) return;
    
    const { importedProduct, similarProducts, importDate, remainingProducts } = currentImportItem;
    const now = new Date();
    const historyDate = importDate ? importDate : now;

    for (const product of similarProducts) {
      const history = await getProductHistory(product.id.toString());
      
      // Delete all entries from the same day as the import
      for (const entry of history) {
        const entryDate = parseISO(entry.date);
        if (isSameDay(entryDate, historyDate)) {
          console.log(`Overwriting history entry from ${entry.date}`);
        }
      }
      
      await saveProductHistoryForSingleProduct(
        product.id,
        importedProduct.quantity,
        historyDate
      );
      
      await updateProduct(product.id, importedProduct.quantity);
    }
    
    setConfirmationModalVisible(false);
    await processNextProduct(remainingProducts);
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
    try {
      if (!currentImportItem?.bestMatch) return;

      await updateProductQuantity(
        currentImportItem.bestMatch.id,
        currentImportItem.importedProduct.quantity
      );

      const remainingProducts = currentImportItem.remainingProducts;
      setConfirmationModalVisible(false);
      await processNextProduct(remainingProducts);
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
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

  const styles = StyleSheet.create<StyleSheet>({
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
    buttonLabel: {
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
      padding: 20,
    },
    modalContainer: {
      backgroundColor: "white",
      padding: 20,
      borderRadius: 12,
      width: '100%',
      maxHeight: '100%',
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
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 16,
      textAlign: "center",
      color: "#333",
    },
    confirmationContent: {
      maxHeight: '60%',
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
      padding: 12,
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
      fontSize: 14,
      color: "#666",
      marginBottom: 4,
    },
    productValue: {
      fontSize: 16,
      color: "#333",
      marginBottom: 8,
      fontWeight: "500",
    },
    modalButtonsStacked: {
      marginTop: 16,
    },
    stackedButton: {
      marginVertical: 6,
      borderRadius: 8,
      height: 45,
      justifyContent: 'center',
    },
    cancelButtonLabel: {
      color: "#dc3545",
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
            labelStyle={styles.buttonLabel}
          >
            Salvar
          </Button>

          <Button
            mode="contained"
            onPress={handleImportButtonClick}
            icon="import"
            style={styles.button}
            labelStyle={styles.buttonLabel}
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
                labelStyle={styles.buttonLabel}
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

        <Modal
          visible={confirmationModalVisible}
          onRequestClose={() => setConfirmationModalVisible(false)}
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Produto Similar Encontrado</Text>
              <View style={styles.confirmationContent}>
                <View style={styles.productInfo}>
                  <Text style={styles.productLabel}>Produto importado:</Text>
                  <Text style={styles.productValue}>{currentImportItem?.importedProduct.originalName}</Text>
                  <Text style={styles.productLabel}>Quantidade:</Text>
                  <Text style={styles.productValue}>{currentImportItem?.importedProduct.quantity}</Text>
                </View>
                <View style={[styles.productInfo, styles.existingProduct]}>
                  <Text style={styles.productLabel}>Produto existente:</Text>
                  <Text style={styles.productValue}>{currentImportItem?.bestMatch?.name}</Text>
                  <Text style={styles.productLabel}>Quantidade atual:</Text>
                  <Text style={styles.productValue}>{currentImportItem?.bestMatch?.quantity}</Text>
                </View>
                {currentImportItem?.similarProducts.length > 1 && (
                  <View style={styles.similarProducts}>
                    <Text style={styles.productLabel}>Outros produtos similares encontrados:</Text>
                    {currentImportItem.similarProducts.slice(1).map((product, index) => (
                      <Text key={index} style={styles.similarProductItem}>
                        • {product.name} (Qtd: {product.quantity})
                      </Text>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.modalButtonsStacked}>
                <Button 
                  mode="contained"
                  onPress={handleUpdateQuantityOnly}
                  style={styles.stackedButton}
                  labelStyle={styles.buttonLabel}
                >
                  Atualizar Apenas Quantidade
                </Button>
                <Button 
                  mode="contained"
                  onPress={handleConfirmOverwrite} 
                  style={styles.stackedButton}
                  labelStyle={styles.buttonLabel}
                >
                  Sobrescrever Este Produto
                </Button>
                {currentImportItem?.similarProducts.length > 1 && (
                  <Button 
                    mode="contained-tonal"
                    onPress={handleAcceptAllSimilar} 
                    style={styles.stackedButton}
                    labelStyle={styles.buttonLabel}
                  >
                    Sobrescrever Todos Similares
                  </Button>
                )}
                <Button 
                  mode="contained-tonal"
                  onPress={handleAcceptAllSuggestions} 
                  style={styles.stackedButton}
                  labelStyle={styles.buttonLabel}
                >
                  Aceitar Todas as Sugestões
                </Button>
                <Button 
                  mode="outlined"
                  onPress={handleCreateNew} 
                  style={styles.stackedButton}
                  labelStyle={styles.buttonLabel}
                >
                  Criar Novo Produto
                </Button>
                <Button 
                  mode="outlined"
                  onPress={handleSkipImport} 
                  style={styles.stackedButton}
                  labelStyle={styles.buttonLabel}
                >
                  Pular Este Produto
                </Button>
                <Button 
                  mode="text"
                  onPress={handleCancelAllImports} 
                  style={styles.stackedButton}
                  labelStyle={[styles.buttonLabel, styles.cancelButtonLabel]}
                >
                  Cancelar Importação
                </Button>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}
