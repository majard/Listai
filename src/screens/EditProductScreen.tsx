import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  SafeAreaView,
} from "react-native";
import {
  TextInput as PaperTextInput,
  Button,
  Text,
  useTheme,
  Card,
  IconButton,
} from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { LineChart } from "react-native-chart-kit";
import {
  Product,
  updateProduct,
  getProductHistory,
  QuantityHistory,
  updateProductName,
  deleteProduct,
} from "../database/database";
import { RootStackParamList } from "../types/navigation";

type EditProductScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "EditProduct"
>;
type EditProductScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "EditProduct"
>;

export default function EditProductScreen() {
  const route = useRoute<EditProductScreenProps["route"]>();
  const { product } = route.params;
  const [quantity, setQuantity] = useState(product.quantity.toString());
  const [history, setHistory] = useState<QuantityHistory[]>([]);
  const navigation = useNavigation<EditProductScreenNavigationProp>();
  const theme = useTheme();
  const [name, setName] = useState(product.name);
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await getProductHistory(product.id);
      setHistory(data);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    }
  };

  const handleUpdate = async () => {
    try {
      await updateProduct(product.id, parseInt(quantity, 10));
      navigation.navigate("Home", { shouldRefresh: true });
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
    }
  };

  const handleNameUpdate = async () => {
    try {
      await updateProductName(product.id, name);
      setIsEditingName(false);
      navigation.setParams({ product: { ...product, name } });
    } catch (error) {
      console.error("Erro ao atualizar nome do produto:", error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProduct(product.id);
      navigation.navigate("Home", { shouldRefresh: true });
    } catch (error) {
      console.error("Erro ao deletar produto:", error);
    }
  };

  const formatChartLabel = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const formatHistoryDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const chartData = {
    labels: [...history]
      .reverse()
      .slice(-7)
      .map((h) => formatChartLabel(h.date)),
    datasets: [
      {
        data: [...history]
          .reverse()
          .slice(-7)
          .map((h) => h.quantity),
      },
    ],
  };

  return (
    <SafeAreaView style={{flex: 1}}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          {isEditingName ? (
            <View style={styles.nameEditContainer}>
              <PaperTextInput
                value={name}
                onChangeText={setName}
                style={styles.nameInput}
                mode="outlined"
              />
              <IconButton
                icon="check"
                size={24}
                onPress={handleNameUpdate}
                iconColor={theme.colors.primary}
              />
              <IconButton
                icon="close"
                size={24}
                onPress={() => {
                  setName(product.name);
                  setIsEditingName(false);
                }}
                iconColor={theme.colors.error}
              />
            </View>
          ) : (
            <View style={styles.nameContainer}>
              <Text variant="titleLarge" style={styles.title}>
                {product.name}
              </Text>
              <IconButton
                icon="pencil"
                size={24}
                onPress={() => setIsEditingName(true)}
                iconColor={theme.colors.primary}
              />
            </View>
          )}
          <IconButton
            icon="delete"
            size={24}
            onPress={handleDelete}
            iconColor={theme.colors.error}
          />
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.subtitle}>
              Quantidade Atual
            </Text>
            <PaperTextInput
              label="Quantidade"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              style={styles.input}
              mode="outlined"
            />
            <Button
              mode="contained"
              onPress={handleUpdate}
              style={styles.button}
              disabled={!quantity}
            >
              Atualizar Quantidade
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.subtitle}>
              Histórico de Quantidades
            </Text>
            {history.length > 0 ? (
              <View>
                <LineChart
                  data={chartData}
                  width={Dimensions.get("window").width - 64}
                  height={220}
                  chartConfig={{
                    backgroundColor: theme.colors.primary,
                    backgroundGradientFrom: theme.colors.primary,
                    backgroundGradientTo: theme.colors.primary,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    style: {
                      borderRadius: 16,
                    },
                  }}
                  bezier
                  style={styles.chart}
                />
                <View style={styles.historyList}>
                  {history.map((item, index) => (
                    <View key={item.id} style={styles.historyItem}>
                      <Text variant="bodyMedium">
                        {formatHistoryDate(item.date)}
                      </Text>
                      <Text variant="bodyMedium">
                        Quantidade: {item.quantity}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text>Nenhum histórico disponível</Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingTop: 64,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  nameEditContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  nameInput: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    flex: 1,
  },
  subtitle: {
    marginBottom: 16,
  },
  card: {
    margin: 16,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  historyList: {
    marginTop: 16,
    paddingBottom: 64,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
});
