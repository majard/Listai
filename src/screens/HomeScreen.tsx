import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { FAB, Card, Text, IconButton, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Product, getProducts, deleteProduct, updateProduct } from '../database/database';
import { RootStackParamList } from '../types/navigation';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const theme = useTheme();

  const loadProducts = async () => {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await deleteProduct(id);
      loadProducts();
    } catch (error) {
      console.error('Erro ao deletar produto:', error);
    }
  };

  const handleQuantityChange = async (id: number, currentQuantity: number, increment: boolean) => {
    try {
      const newQuantity = increment ? currentQuantity + 1 : Math.max(0, currentQuantity - 1);
      await updateProduct(id, newQuantity, products.find(p => p.id === id)?.weight || 0);
      loadProducts();
    } catch (error) {
      console.error('Erro ao atualizar quantidade:', error);
    }
  };

  const handleWeightChange = async (id: number, currentWeight: number, increment: boolean) => {
    try {
      const newWeight = increment ? currentWeight + 10 : Math.max(0, currentWeight - 10);
      await updateProduct(id, products.find(p => p.id === id)?.quantity || 0, newWeight);
      loadProducts();
    } catch (error) {
      console.error('Erro ao atualizar peso:', error);
    }
  };

  const renderItem = ({ item }: { item: Product }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Text variant="titleMedium">{item.name}</Text>
          <IconButton
            icon="delete"
            size={20}
            onPress={() => handleDelete(item.id)}
            iconColor={theme.colors.error}
          />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.quantityContainer}>
            <Text variant="bodyMedium">Quantidade: {item.quantity}</Text>
            <View style={styles.quantityButtons}>
              <IconButton
                icon="minus"
                size={20}
                onPress={() => handleQuantityChange(item.id, item.quantity, false)}
              />
              <IconButton
                icon="plus"
                size={20}
                onPress={() => handleQuantityChange(item.id, item.quantity, true)}
              />
            </View>
          </View>
          <View style={styles.weightContainer}>
            <Text variant="bodyMedium">Peso: {item.weight}g</Text>
            <View style={styles.weightButtons}>
              <IconButton
                icon="minus"
                size={20}
                onPress={() => handleWeightChange(item.id, item.weight, false)}
              />
              <IconButton
                icon="plus"
                size={20}
                onPress={() => handleWeightChange(item.id, item.weight, true)}
              />
            </View>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
      />
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('AddProduct')}
        label="Adicionar Produto"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  list: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardContent: {
    marginTop: 8,
  },
  quantityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  weightContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityButtons: {
    flexDirection: 'row',
  },
  weightButtons: {
    flexDirection: 'row',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
}); 