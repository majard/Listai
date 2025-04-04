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
} from "../database/database";
import { RootStackParamList } from "../types/navigation";

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

  const handleQuantityInput = async (id: number, value: string) => {
    try {
      if (value === "") {
        await updateProduct(id, 0);
        loadProducts();
        return;
      }
      const newQuantity = parseInt(value, 10);
      if (!isNaN(newQuantity) && newQuantity >= 0) {
        await updateProduct(id, newQuantity);
        loadProducts();
      }
    } catch (error) {
      console.error("Erro ao atualizar quantidade:", error);
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
 
  const importStockList = async (text: string) => {
    try {
      const lines = text.split("\n");
      const dateRegex = /(\d{2}\/\d{2}\/\d{4})/;
      let importDate: Date | null = null;

      for (const line of lines) {
        const dateMatch = line.match(dateRegex);
        if (dateMatch) {
          const [day, month, year] = dateMatch[1].split("/").map(Number);
          importDate = new Date(year, month - 1, day);
          break;
        }
      }

      const productRegex = /- (.+): (\d+) /;
      for (const line of lines) {
        const productMatch = line.match(productRegex);
        if (productMatch) {
          // Trim whitespace from the extracted name
          const name = productMatch[1].trim();
          const quantity = parseInt(productMatch[2], 10);

          console.log('Importing:', { name, quantity });

          const productHistory = await getProductHistory(name);
          if (productHistory && importDate) {
            const latestHistoryDate = new Date(productHistory.date);
            if (latestHistoryDate < importDate) {
              const existingProduct = products.find((p) => p.name === name);
              if (existingProduct) {
                await updateProduct(existingProduct.id, quantity);
              } else {
                await createProduct(name, quantity);
              }
            }
          } else {
            const existingProduct = products.find((p) => p.name === name);
            if (existingProduct) {
              await updateProduct(existingProduct.id, quantity);
            } else {
              await createProduct(name, quantity);
            }
          }
        }
      }
      loadProducts();
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
                      onChangeText={(value) =>
                        handleQuantityInput(item.id, value)
                      }
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
      <Button
          mode="contained"
          onPress={generateAndCopyStockList}
          style={styles.copyButton}
          icon="content-copy"
        >
          Salvar e copiar relatório
        </Button>

        <View style={styles.buttonRow}>
          <Button
            mode="contained"
            onPress={handleImportButtonClick}
            icon="import"
          >
            <Text>Importar Lista</Text>{" "}
            {/* Wrap the text in a <Text> component */}
          </Button>
          <Menu
            visible={menuVisible}
            onDismiss={closeMenu}
            anchor={
              <Button icon="sort" onPress={openMenu}>
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
        data={products}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  copyButton: { marginBottom: 8 },
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
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  modalContainer: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 8,
    width: 300, 
    height: 600,  
    margin: 42
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center", // Center the title
  },
  modalInput: {
    height: 150, // Adjust height as needed
    flexGrow: 1, // Allows it to grow within the maxHeight
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
