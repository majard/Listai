import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput as PaperTextInput, Button, Text, useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Product, updateProduct } from '../database/database';
import { RootStackParamList } from '../types/navigation';

type EditProductScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditProduct'>;
type EditProductScreenProps = NativeStackScreenProps<RootStackParamList, 'EditProduct'>;

export default function EditProductScreen() {
  const route = useRoute<EditProductScreenProps['route']>();
  const { product } = route.params;
  const [quantity, setQuantity] = useState(product.quantity.toString());
  const [weight, setWeight] = useState(product.weight.toString());
  const navigation = useNavigation<EditProductScreenNavigationProp>();
  const theme = useTheme();

  const handleUpdate = async () => {
    try {
      await updateProduct(
        product.id,
        parseInt(quantity, 10),
        parseInt(weight, 10)
      );
      navigation.goBack();
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
    }
  };

  const handleQuantityChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      setQuantity(value);
    }
  };

  const handleWeightChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      setWeight(value);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="titleLarge" style={styles.title}>
        {product.name}
      </Text>
      <PaperTextInput
        label="Quantidade"
        value={quantity}
        onChangeText={handleQuantityChange}
        keyboardType="numeric"
        style={styles.input}
        mode="outlined"
      />
      <PaperTextInput
        label="Peso (g)"
        value={weight}
        onChangeText={handleWeightChange}
        keyboardType="numeric"
        style={styles.input}
        mode="outlined"
      />
      <Button
        mode="contained"
        onPress={handleUpdate}
        style={styles.button}
        disabled={!quantity || !weight}
      >
        Salvar Alterações
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
}); 