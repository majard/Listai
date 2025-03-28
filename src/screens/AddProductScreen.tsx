import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput as PaperTextInput, Button, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { addProduct } from '../database/database';
import { RootStackParamList } from '../types/navigation';

type AddProductScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AddProduct'>;

export default function AddProductScreen() {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [weight, setWeight] = useState('0');
  const navigation = useNavigation<AddProductScreenNavigationProp>();
  const theme = useTheme();

  const handleSubmit = async () => {
    try {
      await addProduct(
        name,
        parseInt(quantity, 10),
        parseInt(weight, 10)
      );
      navigation.goBack();
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
    }
  };

  return (
    <View style={styles.container}>
      <PaperTextInput
        label="Nome do Produto"
        value={name}
        onChangeText={setName}
        style={styles.input}
        mode="outlined"
      />
      <PaperTextInput
        label="Quantidade"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="numeric"
        style={styles.input}
        mode="outlined"
      />
      <PaperTextInput
        label="Peso (g)"
        value={weight}
        onChangeText={setWeight}
        keyboardType="numeric"
        style={styles.input}
        mode="outlined"
      />
      <Button
        mode="contained"
        onPress={handleSubmit}
        style={styles.button}
        disabled={!name || !quantity || !weight}
      >
        Adicionar Produto
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
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
}); 