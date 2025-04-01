import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('listai.db');

export interface Product {
  id: number;
  name: string;
  quantity: number;
  order: number;
}

export interface QuantityHistory {
  id: number;
  productId: number;
  quantity: number;
  date: string;
}

export const initDatabase = () => {
  return new Promise((resolve, reject) => {
    try {
      // Create products table with order column
      db.execSync(
        'CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, quantity INTEGER NOT NULL, `order` INTEGER NOT NULL DEFAULT 0);'
      );
      
      // Create quantity history table
      db.execSync(
        'CREATE TABLE IF NOT EXISTS quantity_history (id INTEGER PRIMARY KEY AUTOINCREMENT, productId INTEGER NOT NULL, quantity INTEGER NOT NULL, date TEXT NOT NULL, FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE);'
      );
      
      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
};

export const addProduct = (name: string, quantity: number): Promise<number> => {
  return new Promise((resolve, reject) => {
    try {
      // Insert into products table without lastUpdated
      db.execSync(
        `INSERT INTO products (name, quantity) VALUES ('${name}', ${quantity});`
      );
      
      const result = db.getFirstSync('SELECT last_insert_rowid() as id;') as { id: number };
      
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
      const result = db.getAllSync('SELECT * FROM products ORDER BY `order` ASC;');
      resolve(result as Product[]);
    } catch (error) {
      reject(error);
    }
  });
};

export const getProductHistory = (productId: number): Promise<QuantityHistory[]> => {
  return new Promise((resolve, reject) => {
    try {
      const result = db.getAllSync(
        `SELECT * FROM quantity_history WHERE productId = ${productId} ORDER BY date DESC;`
      );
      resolve(result as QuantityHistory[]);
    } catch (error) {
      reject(error);
    }
  });
};

export const updateProduct = (id: number, quantity: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Only update the quantity, don't update history
      db.execSync(
        `UPDATE products SET quantity = ${quantity} WHERE id = ${id};`
      );
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

export const saveProductHistory = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const date = new Date().toISOString();
      const products = db.getAllSync('SELECT * FROM products;') as Product[];
      
      // Update lastUpdated for all products
      products.forEach(product => {
        
        // Add current quantities to history
        db.execSync(
          `INSERT INTO quantity_history (productId, quantity, date) VALUES (${product.id}, ${product.quantity}, '${date}');`
        );
      });
      
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

export const deleteProduct = (id: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // The quantity_history entries will be automatically deleted due to ON DELETE CASCADE
      db.execSync(`DELETE FROM products WHERE id = ${id};`);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

export const updateProductOrder = (updates: { id: number; order: number }[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      db.execSync('BEGIN TRANSACTION;');
      
      updates.forEach(({ id, order }) => {
        db.execSync(
          `UPDATE products SET \`order\` = ${order} WHERE id = ${id};`
        );
      });
      
      db.execSync('COMMIT;');
      resolve();
    } catch (error) {
      db.execSync('ROLLBACK;');
      reject(error);
    }
  });
}; 