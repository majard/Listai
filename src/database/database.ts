import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('listai.db');

export interface Product {
  id: number;
  name: string;
  quantity: number;
  weight: number;
}

export const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, quantity INTEGER NOT NULL, weight INTEGER NOT NULL);',
        [],
        () => {
          resolve(true);
        },
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
};

export const addProduct = (name: string, quantity: number, weight: number): Promise<number> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'INSERT INTO products (name, quantity, weight) VALUES (?, ?, ?);',
        [name, quantity, weight],
        (_, result) => {
          resolve(result.insertId);
        },
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
};

export const getProducts = (): Promise<Product[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM products;',
        [],
        (_, { rows: { _array } }) => {
          resolve(_array);
        },
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
};

export const updateProduct = (id: number, quantity: number, weight: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'UPDATE products SET quantity = ?, weight = ? WHERE id = ?;',
        [quantity, weight, id],
        () => {
          resolve();
        },
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
};

export const deleteProduct = (id: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'DELETE FROM products WHERE id = ?;',
        [id],
        () => {
          resolve();
        },
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
}; 