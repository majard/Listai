import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { List, Button, Card, IconButton, FAB, useTheme } from "react-native-paper";
import { getLists } from "../database/database";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { getEmojiForList } from "../utils/stringUtils";

type ListItem = {
  id: number;
  name: string;
};

export default function ListsScreen() {
  const [lists, setLists] = useState<ListItem[]>([]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();

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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.primary }]}>Suas Listas</Text>
      {lists.length === 0 ? (
        <Text style={{ textAlign: 'center', color: theme.colors.onBackground, marginTop: 32 }}>Nenhuma lista encontrada.</Text>
      ) : (
        lists.map((item) => (
          <Card
            key={item.id}
            style={{ marginBottom: 16, borderRadius: 12, elevation: 2 }}
            onPress={() => navigation.navigate("Home", { listId: item.id })}
          >
            <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 28, marginRight: 16 }}>{getEmojiForList(item.name)}</Text>
              <Text style={{ fontSize: 18, flex: 1, color: theme.colors.onSurface }}>{item.name}</Text>
              <IconButton icon="chevron-right" size={28} />
            </Card.Content>
          </Card>
        ))
      )}
      <FAB
        icon="plus"
        label="Adicionar Lista"
        style={{ position: 'absolute', right: 24, bottom: 32, backgroundColor: theme.colors.primary }}
        color={theme.colors.onPrimary}
        onPress={() => navigation.navigate("AddList")}
      />
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
