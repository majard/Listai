import React, { useState, useEffect, useCallback } from "react";
import { View, Alert, } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  TextInput as PaperTextInput,
  Button,
  useTheme,
  Text,
  IconButton,
  FAB,
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
import { Product } from "../database/database";
import { RootStackParamList } from "../types/navigation";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import { getEmojiForProduct } from "../utils/stringUtils";
import ImportModal from "../components/ImportModal";
import useProducts from "../hooks/useProducts"; 
import { SortOrder } from "../utils/sortUtils";
import SearchBar from "../components/SearchBar";
import { useList } from "../hooks/useList";
import { SortMenu } from "../components/SortMenu";
import { ProductCard } from "../components/ProductCard";

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
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    products,
    filteredProducts,
    loadProducts,
    handleProductOrderChange,
    saveProductHistory,
  } = useProducts(listId, sortOrder, searchQuery);

  const {
    listName,
    isEditingListName,
    listNameInput,
    setListNameInput,
    handleListNameEdit,
    handleListNameSave,
    handleListDelete,
    setIsEditingListName,
  } = useList(listId);


  const handleImportButtonClick = useCallback(() => {
    setIsImportModalVisible(true);
  }, []);

  const handleSortOrderChange = useCallback((order: SortOrder) => {
    setSortOrder(order);
  }, []);

  // useFocusEffect is still crucial here to ensure the list refreshes
  // after single product operations (update, delete) performed via useProduct.
  useEffect(() => {
    loadProducts();
  }, [sortOrder, loadProducts]);

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
    }) => (
      <ScaleDecorator>
        <ProductCard
          item={item}
          drag={drag}
          isActive={isActive}
        />
      </ScaleDecorator>
    ),
    []
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

          <SortMenu setSortOrder={handleSortOrderChange} sortOrder={sortOrder} />
        </View>
      </View>
      <DraggableFlatList
        data={filteredProducts}
        onDragEnd={handleProductOrderChange}
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