import React, { useState, useEffect, useCallback } from "react";
import { View, Alert, Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
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
import { saveProductHistory, Product } from "../database/database"; // Removed other database imports
import { RootStackParamList } from "../types/navigation";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import { getEmojiForProduct } from "../utils/stringUtils";
import ImportModal from "../components/ImportModal";
import useProducts from "../hooks/useProducts"; // Ensure this is the updated useProducts
import { SortOrder } from "../utils/sortUtils";
import SearchBar from "../components/SearchBar";
import { useList } from "../hooks/useList"; // Import the new hook

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;
type HomeScreenProps = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen() {
  const route = useRoute<HomeScreenProps["route"]>();
  const listId = route.params?.listId ?? 1;

  const navigation = useNavigation<HomeScreenNavigationProp>();
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const [sortOrder, setSortOrder] = useState<SortOrder>("custom");
  const [menuVisible, setMenuVisible] = useState(false);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Use useProducts hook for all product-related state and logic
  const {
    products, // Retain for extraData in DraggableFlatList
    filteredProducts, // The output of filtered and sorted products
    loadProducts,
    updateProductQuantity, // Unified quantity update
    confirmRemoveProduct, // Handles the alert and removal
    startContinuousAdjustment,
    stopContinuousAdjustment,
    handleProductOrderChange, // Handles drag-and-drop order updates
  } = useProducts(listId, sortOrder, searchQuery);

  // Use useListManagement hook for all list-related state and logic
  const {
    listName,
    isEditingListName,
    listNameInput,
    setListNameInput,
    handleListNameEdit,
    handleListNameSave,
    handleListDelete,
    setIsEditingListName,
  } = useListManagement(listId);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const handleImportButtonClick = () => {
    setIsImportModalVisible(true);
  };

  // This useEffect now just triggers product reload when sortOrder changes.
  // The actual sorting is handled inside useProducts.
  useEffect(() => {
    loadProducts();
  }, [sortOrder, loadProducts]);

  // useFocusEffect should trigger loadProducts to refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

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
      // Use the 'products' state directly here, as it represents the current list.
      products.forEach((product) => {
        const emoji = getEmojiForProduct(product.name);
        text += `- ${product.name}: ${product.quantity} ${emoji}\n`;
      });
      Clipboard.setStringAsync(text);
      Alert.alert("Sucesso", "Lista de estoque copiada para a área de transferência!");
    } catch (error) {
      console.error("Erro ao salvar histórico e copiar lista:", error);
      Alert.alert("Erro", "Não foi possível copiar a lista de estoque.");
    }
  };

  const renderItem = useCallback(
    ({
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
              onPress={() => navigation.navigate("EditProduct", { product: item })}
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
                      onPress={() => confirmRemoveProduct(item.id)} // Use from useProducts
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
                          // Call the unified update function
                          updateProductQuantity(item.id, value === "" ? 0 : parseInt(value, 10))
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
                        // Call the unified update function with calculation
                        onPress={() => updateProductQuantity(item.id, Math.max(0, item.quantity - 1))}
                        onLongPress={() =>
                          startContinuousAdjustment(item.id, false) // Pass boolean directly
                        }
                        onPressOut={stopContinuousAdjustment}
                      />
                      <IconButton
                        icon="plus"
                        size={20}
                        // Call the unified update function with calculation
                        onPress={() => updateProductQuantity(item.id, item.quantity + 1)}
                        onLongPress={() =>
                          startContinuousAdjustment(item.id, true) // Pass boolean directly
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
    },
    [
      navigation,
      styles,
      theme,
      confirmRemoveProduct,
      updateProductQuantity,
      startContinuousAdjustment,
      stopContinuousAdjustment,
    ]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* List Name Editing/Display */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
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
        <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
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
        data={filteredProducts} // Call the function to get the latest filtered data
        onDragEnd={handleProductOrderChange} // Use from useProducts
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        extraData={products} // Still useful if `filteredProducts` changes often
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