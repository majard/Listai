import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Text } from 'react-native';
import { TextInput as PaperTextInput, Button, useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { addProduct } from '../database/database';
import { RootStackParamList } from '../types/navigation';

type AddProductScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AddProduct'>;
type AddProductScreenProps = NativeStackScreenProps<RootStackParamList, 'AddProduct'>;

export default function AddProductScreen() {
  const route = useRoute<AddProductScreenProps["route"]>();
  const listId = route.params?.listId ?? 1;
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('0');
  const navigation = useNavigation<AddProductScreenNavigationProp>();
  const theme = useTheme();

  console.log("addproduct listId: ", listId);

  const handleSubmit = async () => {    
    console.log('before trying');
    try {
      console.log('adding product');
      console.log('listId: ', listId);
      await addProduct(
        name,
        parseInt(quantity, 10), 
        listId
      );
      navigation.navigate('Home', { shouldRefresh: true });
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <PaperTextInput
          label="Nome do Produto"
          value={name}
          onChangeText={setName}
          style={styles.input}
          mode="outlined"
          autoFocus
          blurOnSubmit={false}
          returnKeyType="next"
          testID="product-name-input"
        />
        <PaperTextInput
          label="Quantidade"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          style={styles.input}
          mode="outlined"
          blurOnSubmit={true}
          returnKeyType="done"
          testID="product-quantity-input"
        />
        <TouchableOpacity
          //mode="contained"
          onPress={handleSubmit}
          //style={styles.TouchableOpacity}
          disabled={false}
          testID="add-product-button"
        >
          <Text>Adicionar Produto</Text>
          
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
});