import React, { useEffect, useState, useRef } from "react";
import { View, StyleSheet, Clipboard, Pressable, Alert } from "react-native";
import {
  FAB,
  Card,
  Text,
  IconButton,
  useTheme,
  TextInput,
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
} from "../database/database";
import { RootStackParamList } from "../types/navigation";
import { log } from "console";

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
    "custom" | "alphabetical" | "quantity"
  >("custom");
  const [menuVisible, setMenuVisible] = useState(false);
  

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const sortProducts = (productsToSort: Product[]) => {
    let sortedProducts = [...productsToSort];


    switch (sortOrder) {
      case "alphabetical":
        sortedProducts.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "quantity":
        sortedProducts.sort((a, b) => a.quantity - b.quantity); // Ascending order
        break;
      case "custom":
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
      // Initial delay before starting continuous adjustment
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
        {
          text: "Cancelar",
          style: "cancel",
        },
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
      ],
      { cancelable: true }
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
    // Initial adjustment
    handleQuantityChange(id, currentQuantity, increment);

    // Start continuous adjustment
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
      // Update local state immediately
      setProducts(data);

      // Update database
      const updates = data.map((product, index) => ({
        id: product.id,
        order: index,
      }));

      await updateProductOrder(updates);
    } catch (error) {
      console.error("Erro ao reordenar produtos:", error);
      // Reload original order if there's an error
      loadProducts();
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
              setSortOrder("quantity");
              closeMenu();
            }}
            title="Quantidade"
          />
        </Menu>
      </View>
      <DraggableFlatList
        data={products}
        onDragEnd={handleDragEnd}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        extraData = {products}
      />
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate("AddProduct")}
        label="Adicionar Produto"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  copyButton: {
    marginBottom: 8,
  },
  list: {
    padding: 16,
    paddingBottom: 160,
  },
  card: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dragHandle: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardContent: {
    marginTop: 8,
  },
  quantityContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  quantityButtons: {
    flexDirection: "row",
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
  quantityInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  input: {
    flex: 1,
    marginHorizontal: 8,
  },
  cardActions: {
    flexDirection: "row",
  },
});
