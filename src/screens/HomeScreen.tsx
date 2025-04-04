import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Clipboard,
  Pressable,
  Alert,
  TextInput,
  Modal,
  TextInput as RNTextInput,
  SafeAreaView,
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

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;

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
  const [quantityTimeout, setQuantityTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isInputEmpty, setIsInputEmpty] = useState(false);

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
    console.log("Import Text submitted:", importText); // Add this line
    importStockList(importText);
    setIsImportModalVisible(false);
    setImportText("");
  };

  const handleImportModalCancel = () => {
    console.log("Cancelando importação");
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

  // Debounced updateProduct function
  const debouncedUpdateProduct = debounce(async (id, quantity) => {
    await updateProduct(id, quantity);
    loadProducts(); // Reload products to reflect changes
  }, 700);

  const handleQuantityInput = (id: number, value: string) => {
    // Update the local state immediately
    setProducts((prevProducts) =>
      prevProducts.map((product) =>
        product.id === id ? { ...product, quantity: value === "" ? 0 : parseInt(value, 10) } : product // Ensure quantity is a number
      )
    );

    // If the input is empty, update to 0
    if (value === "") {
      debouncedUpdateProduct(id, 0); // Call the debounced function
      return; // Exit the function
    }

    // If the input has a value, parse it and call the debounced function
    const newQuantity = parseInt(value, 10);
    if (!isNaN(newQuantity) && newQuantity >= 0) {
      debouncedUpdateProduct(id, newQuantity); // Call the debounced function
    }
  };

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
      let text = `Boa noite! 🌃 ${dateStr}\n\n`;
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

  const importStockList = async (text: string) => {
    try {
      const lines = text.split("\n");
      const importDate = parseImportDate(lines);
      const importedProducts = parseImportProducts(lines);
      const existingProducts = await getProducts();
      const now = new Date();

      console.log("Parsed importDate:", importDate);

      for (const importedProduct of importedProducts) {
        const processedImportName = preprocessName(
          importedProduct.originalName
        );
        let potentialMatches: { product: Product; similarity: number }[] = [];

        for (const existingProduct of existingProducts) {
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
          let bestMatch: Product | null = null;
          let latestHistoryEntry: QuantityHistory | undefined;

          for (const match of potentialMatches) {
            const history = await getProductHistory(
              match.product.id.toString()
            );
            if (history.length > 0) {
              bestMatch = match.product;
              latestHistoryEntry = history[0]; // Assuming history is sorted by date DESC
              break; // Found the latest, no need to check others for this purpose
            } else if (!bestMatch) {
              bestMatch = match.product; // If no history, consider the first match for new history
            }
          }

          if (bestMatch) {
            console.log(
              `Considering "${importedProduct.originalName}" with existing "${bestMatch.name}" (latest history: ${latestHistoryEntry?.date})`
            );

            if (importDate && !isBefore(importDate, now)) {
              console.log(
                `Skipping history save for "${importedProduct.originalName}" as import date is in the future.`
              );
            } else {
              const historyDate = importDate ? importDate : now;
              await saveProductHistoryForSingleProduct(
                bestMatch.id,
                importedProduct.quantity,
                historyDate
              );

              if (importDate && latestHistoryEntry) {
                const lastHistoryDate = parseISO(latestHistoryEntry.date);
                if (
                  isBefore(lastHistoryDate, importDate) &&
                  isSameDay(importDate, historyDate)
                ) {
                  console.log(
                    `Overwriting quantity of "${bestMatch.name}" with imported "${importedProduct.originalName}": ${importedProduct.quantity} (imported date is newer than last history)`
                  );
                  await updateProduct(bestMatch.id, importedProduct.quantity);
                } else {
                  console.log(
                    `Not overwriting quantity of "${bestMatch.name}". Last history is not older than import or not same day.`
                  );
                }
              } else if (importDate && !latestHistoryEntry) {
                console.log(
                  `Overwriting quantity of "${bestMatch.name}" with imported "${importedProduct.originalName}": ${importedProduct.quantity} (no existing history)`
                );
                await updateProduct(bestMatch.id, importedProduct.quantity);
              }
            }
          } else {
            console.log(
              `Creating new product: "${importedProduct.originalName}"`
            );
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
          }
        } else {
          console.log(
            `Creating new product (no similar product found): "${importedProduct.originalName}"`
          );
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
        }
      }

      await loadProducts();
    } catch (error) {
      console.error("Erro ao importar lista:", error);
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
                    <TextInput
                      value={item.quantity.toString()}
                      onChangeText={(value) => handleQuantityInput(item.id, value)}
                      keyboardType="numeric"
                      style={styles.input}
                      mode="outlined"
                      dense
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

    console.log("Processed Product Name:", processedProductName);
    console.log("Processed Search Query:", processedSearchQuery);

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
    console.log("Similarity:", similarity);

    return similarity >= searchSimilarityThreshold;
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Pesquisar"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
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
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate("AddProduct")}
        label="Adicionar Produto"
      />
      <View>
        <Modal
          visible={isImportModalVisible}
          onRequestClose={() => setIsImportModalVisible(false)}
          transparent={true}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Importar Lista</Text>
            <RNTextInput
              style={styles.modalInput}
              multiline
              value={importText}
              onChangeText={setImportText}
              placeholder="Cole a lista aqui..."
            />
            <View style={styles.modalButtons}>
              <Button
                onPress={handleImportModalCancel}
                style={styles.modalButton}
              >
                Cancelar
              </Button>
              <Button
                onPress={handleImportModalImport}
                style={styles.modalButton}
              >
                Importar
              </Button>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  button: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  buttonLabel: {
    fontSize: 12,
  },
  list: { padding: 16, paddingBottom: 160 },
  card: { marginBottom: 16 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dragHandle: { flexDirection: "row", alignItems: "center" },
  cardContent: { marginTop: 8 },
  quantityContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  quantityButtons: { flexDirection: "row" },
  fab: { position: "absolute", margin: 16, right: 0, bottom: 0 },
  quantityInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  input: { flex: 1, marginHorizontal: 8 },
  cardActions: { flexDirection: "row" },
  modalContainer: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 8,
    width: 300,
    height: 600,
    margin: 42,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalInput: {
    height: 150,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "gray",
    marginBottom: 10,
    padding: 10,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
});
