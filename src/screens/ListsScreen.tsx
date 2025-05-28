import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { List, Button } from "react-native-paper";
import { getLists } from "../database/database";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";

type ListItem = {
  id: number;
  name: string;
};

export default function ListsScreen() {
  const [lists, setLists] = useState<ListItem[]>([]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const loadLists = async () => {
    const result = await getLists();
    setLists(result);
  };

  useFocusEffect(
    useCallback(() => {
      loadLists();
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Suas Listas</Text>

      <FlatList
        data={lists}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            onPress={() => navigation.navigate("Home", { listId: item.id })}
          />
        )}
      />

      <Button
        mode="contained"
        onPress={() => navigation.navigate("AddList")}
        style={styles.button}
      >
        Adicionar Lista
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    marginBottom: 32, 
  },
  title: {
    fontSize: 24,
    marginBottom: 16,
    fontWeight: "bold",
  },
  button: {
    marginTop: 16,
  },
});
