import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('listai.db');

export interface Product {
  id: number;
  name: string;
  quantity: number;
  weight: number;
}

interface LastInsertId {
  id: number;
}

export const initDatabase = () => {
  return new Promise((resolve, reject) => {
    try {
      db.execSync(
        'CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, quantity INTEGER NOT NULL, weight INTEGER NOT NULL);'
      );
      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
};

export const addProduct = (name: string, quantity: number, weight: number): Promise<number> => {
  return new Promise((resolve, reject) => {
    try {
      db.execSync(
        `INSERT INTO products (name, quantity, weight) VALUES ('${name}', ${quantity}, ${weight});`
      );
      const result = db.getFirstSync('SELECT last_insert_rowid() as id;') as LastInsertId;
      if (result) {
        resolve(result.id);
      } else {
        reject(new Error('Failed to get inserted ID'));
      }
    } catch (error) {
      reject(error);
    }
  });
};

export const getProducts = (): Promise<Product[]> => {
  return new Promise((resolve, reject) => {
    try {
      const result = db.getAllSync('SELECT * FROM products;');
      resolve(result as Product[]);
    } catch (error) {
      reject(error);
    }
  });
};

export const updateProduct = (id: number, quantity: number, weight: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      db.execSync(
        `UPDATE products SET quantity = ${quantity}, weight = ${weight} WHERE id = ${id};`
      );
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

export const deleteProduct = (id: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      db.execSync(`DELETE FROM products WHERE id = ${id};`);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}; 