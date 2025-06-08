import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Alert,
  Pressable,
} from "react-native";
import * as Clipboard from 'expo-clipboard';
import {
  TextInput as PaperTextInput,
  Button,
  useTheme,
  Text,
  Card,
  IconButton,
  FAB,
  Menu,
  Divider,
} from "react-native-paper";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import DraggableFlatList, {
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import {
  getProducts,
  Product,
  deleteProduct,
  updateProduct,
  updateProductOrder,
  saveProductHistory,
  getListById,
  updateListName,
  deleteList,
} from "../database/database";
import { calculateSimilarity, preprocessName } from "../utils/similarityUtils";
import { RootStackParamList } from "../types/navigation";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import { getEmojiForProduct } from "../utils/stringUtils";
import ImportModal from "../components/ImportModal";
import useProducts from "../hooks/useProducts"
import { sortProducts } from "../utils/sortUtils";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;
type HomeScreenProps = NativeStackScreenProps<RootStackParamList, "Home">;

const searchSimilarityThreshold = 0.4;

export default function HomeScreen() {
  
  const route = useRoute<HomeScreenProps["route"]>();
  const listId = route.params?.listId ?? 1;
  const [listName, setListName] = useState("");
  const [isEditingListName, setIsEditingListName] = useState(false);
  const [listNameInput, setListNameInput] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustmentId, setAdjustmentId] = useState<number | null>(null);
  const [adjustmentIncrement, setAdjustmentIncrement] = useState(false);
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const theme = useTheme();
  const [sortOrder, setSortOrder] = useState<
    "custom" | "alphabetical" | "quantityAsc" | "quantityDesc"
  >("custom");
  const [menuVisible, setMenuVisible] = useState(false);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const {
    products,
    setProducts,
    loadProducts,
    updateQuantity,
    removeProduct,
  } = useProducts(listId, sortOrder, searchQuery);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const handleImportButtonClick = () => {
    setIsImportModalVisible(true);
  };

  useEffect(() => {
    const loadAndSortProducts = async () => {
      try {
        const loadedProducts = await getProducts(listId);
        const sortedProducts = sortProducts(loadedProducts, sortOrder, searchQuery);
        setProducts([...sortedProducts]);
      } catch (error) {
        console.error("Erro ao carregar produtos:", error);
      }
    };
    loadAndSortProducts();
  }, [sortOrder]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

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

                // Update product in database after UI update
                setTimeout(() => {
                  updateProduct(adjustmentId, newQuantity).catch(console.error);
                }, 0);

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
            removeProduct(id);
          },
        },
      ]
    );
  };

  const handleQuantityInput = (id: number, value: string) => {
    // Update UI immediately
    setProducts((prevProducts) =>
      prevProducts.map((product) => {
        if (product.id === id) {
          const newQuantity = value === "" ? 0 : parseInt(value, 10);
          if (!isNaN(newQuantity) && newQuantity >= 0) {
            // Schedule database update with minimal delay
            setTimeout(() => {
              updateProduct(id, newQuantity).catch((error) =>
                console.error("Erro ao atualizar quantidade:", error)
              );
            }, 200);

            return { ...product, quantity: newQuantity };
          }
        }
        return product;
      })
    );
  };

  const handleQuantityChange = (
    id: number,
    currentQuantity: number,
    increment: boolean
  ) => {
    const newQuantity = increment
      ? currentQuantity + 1
      : Math.max(0, currentQuantity - 1);

    // Update UI immediately
    setProducts((prevProducts) =>
      prevProducts.map((product) =>
        product.id === id ? { ...product, quantity: newQuantity } : product
      )
    );

    // Schedule database update with minimal delay
    setTimeout(() => {
      updateProduct(id, newQuantity).catch((error) =>
        console.error("Erro ao atualizar quantidade:", error)
      );
    }, 200);
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
      Clipboard.setStringAsync(text);
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
            testID={`product-card-${item.id}`}
          >
            <Card.Content>
              <View style={styles.cardHeader}>
                <View style={styles.dragHandle}>
                  <Text variant="titleMedium">
                    {item.name + " " + getEmojiForProduct(item.name)}
                  </Text>
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
                    testID={`delete-button-${item.id}`}
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
                        handleQuantityInput(item.id, value)
                      }
                      keyboardType="numeric"
                      style={styles.input}
                      testID={`quantity-text-input-${item.id}`}
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
                      testID={`increment-button-${item.id}`}
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

  const styles = createHomeScreenStyles(theme);

  useEffect(() => {
    getListById(listId).then((list) => {
      if (list) setListName(list.name);
    });
  }, [listId]);

  const handleListNameEdit = () => {
    setIsEditingListName(true);
    setListNameInput(listName);
  };

  const handleListNameSave = async () => {
    if (listNameInput.trim()) {
      await updateListName(listId, listNameInput.trim());
      setListName(listNameInput.trim());
      setIsEditingListName(false);
    }
  };

  const handleListDelete = async () => {
    Alert.alert("Excluir Lista", "Tem certeza que deseja excluir esta lista?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          await deleteList(listId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          {isEditingListName ? (
            <>
              <PaperTextInput
                value={listNameInput}
                onChangeText={setListNameInput}
                style={{ flex: 1, marginRight: 8 }}
                mode="outlined"
                dense
              />
              <IconButton
                icon="check"
                iconColor={theme.colors.primary}
                onPress={handleListNameSave}
              />
              <IconButton
                icon="close"
                iconColor={theme.colors.error}
                onPress={() => setIsEditingListName(false)}
              />
            </>
          ) : (
            <>
              <Text variant="titleLarge" style={{ flex: 1 }}>
                {listName}
              </Text>
              <IconButton
                icon="pencil"
                iconColor={theme.colors.primary}
                onPress={handleListNameEdit}
              />
            </>
          )}
          <IconButton
            icon="delete"
            iconColor={theme.colors.error}
            onPress={handleListDelete}
          />
        </View>
        <View style={styles.searchContainer}>
          <PaperTextInput
            placeholder="Buscar produtos..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            mode="outlined"
            style={styles.searchInput}
            right={
              searchQuery.trim() ? (
                <PaperTextInput.Icon
                  icon="close"
                  size={24}
                  onPress={() => setSearchQuery("")}
                  color={theme.colors.error}
                />
              ) : undefined
            }
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
        testID="draggable-flatlist"
      />
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => navigation.navigate("AddProduct", { listId })}
        label="Adicionar Produto"
      />
      <ImportModal
        isImportModalVisible={isImportModalVisible}
        setIsImportModalVisible={setIsImportModalVisible}
        loadProducts={loadProducts}
        listId={listId}
      />
    </SafeAreaView>
  );
}
