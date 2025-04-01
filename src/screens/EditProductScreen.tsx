import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { TextInput as PaperTextInput, Button, Text, useTheme, Card } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { LineChart } from 'react-native-chart-kit';
import { Product, updateProduct, getProductHistory, QuantityHistory } from '../database/database';
import { RootStackParamList } from '../types/navigation';

type EditProductScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditProduct'>;
type EditProductScreenProps = NativeStackScreenProps<RootStackParamList, 'EditProduct'>;

export default function EditProductScreen() {
  const route = useRoute<EditProductScreenProps['route']>();
  const { product } = route.params;
  const [quantity, setQuantity] = useState(product.quantity.toString());
  const [history, setHistory] = useState<QuantityHistory[]>([]);
  const navigation = useNavigation<EditProductScreenNavigationProp>();
  const theme = useTheme();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await getProductHistory(product.id);
      setHistory(data);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  const handleUpdate = async () => {
    try {
      await updateProduct(
        product.id,
        parseInt(quantity, 10)
      );
      navigation.navigate('Home', { shouldRefresh: true });
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const chartData = {
    labels: history.slice(-7).map(h => formatDate(h.date)),
    datasets: [{
      data: history.slice(-7).map(h => h.quantity)
    }]
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="titleLarge" style={styles.title}>
        {product.name}
      </Text>
      
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
                width={Dimensions.get('window').width - 64}
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
                      {formatDate(item.date)}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    marginVertical: 16,
    textAlign: 'center',
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
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
}); 