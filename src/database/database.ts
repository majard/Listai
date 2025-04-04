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

const expectedSchemas = {
  products: [
    { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'name', type: 'TEXT NOT NULL' },
    { name: 'quantity', type: 'INTEGER NOT NULL' },
    { name: 'order', type: 'INTEGER NOT NULL', default: 0 },
  ],
  quantity_history: [
    { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'productId', type: 'INTEGER NOT NULL' },
    { name: 'quantity', type: 'INTEGER NOT NULL' },
    { name: 'date', type: 'TEXT NOT NULL' },
  ],
};

const getExistingColumns = (tableName: string): string[] => {
  try {
    const result = db.getAllSync(`PRAGMA table_info(${tableName});`) as { name: string }[];
    return result.map(columnInfo => columnInfo.name);
  } catch (error) {
    console.error(`Error getting column info for ${tableName}:`, error);
    return [];
  }
};

const addMissingColumn = (tableName: string, columnName: string, columnType: string, defaultValue: any) => {
  let defaultValueClause = '';
  let notNullClause = '';

  if (defaultValue !== undefined) {
    if (typeof defaultValue === 'string') {
      defaultValueClause = ` DEFAULT '${defaultValue}'`;
    } else if (defaultValue !== null) {
      defaultValueClause = ` DEFAULT ${defaultValue}`;
    } else {
      defaultValueClause = ` DEFAULT NULL`;
    }
  }

  if (columnType.includes('NOT NULL')) {
    if (defaultValue === null || defaultValue === undefined) {
      if (columnType.includes('INTEGER')) {
        defaultValueClause = ' DEFAULT 0';
      } else if (columnType.includes('TEXT')) {
        defaultValueClause = " DEFAULT ''";
      } else {
        defaultValueClause = ' DEFAULT 0'; //fallback to 0.
      }
    }
  }

  const alterStatement = `ALTER TABLE ${tableName} ADD COLUMN \`${columnName}\` ${columnType.replace('NOT NULL', '')}${defaultValueClause};`;
  db.execSync(alterStatement);
};

const repairDatabaseSchema = (tableName: string) => {
  const columns = expectedSchemas[tableName];

  // Check if the table exists
  let tableExists = false;
  try {
    db.execSync(`SELECT 1 FROM ${tableName} LIMIT 1;`);
    tableExists = true;
  } catch (e: any) {
    if (e.message.includes('no such table')) {
      tableExists = false;
    } else {
      throw e; // Re-throw any other errors
    }
  }

  if (!tableExists) {
    const createStatement = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns
      .map(col => `${col.name} ${col.type}`)
      .join(', ')});`;
    db.execSync(createStatement);
  } else {
    const existingColumns = getExistingColumns(tableName);
    columns.forEach(expectedColumn => {
      if (!existingColumns.includes(expectedColumn.name)) {
        addMissingColumn(tableName, expectedColumn.name, expectedColumn.type, expectedColumn.default);
      }
    });
  }
};

export const initDatabase = () => {
  return new Promise((resolve, reject) => {
    try {
      // Create core tables only
      db.execSync(
        'CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, quantity INTEGER NOT NULL);'
      );
      db.execSync(
        'CREATE TABLE IF NOT EXISTS quantity_history (id INTEGER PRIMARY KEY AUTOINCREMENT, productId INTEGER NOT NULL, quantity INTEGER NOT NULL, date TEXT NOT NULL, FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE);'
      );
      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
};

export const createProduct = (name: string, quantity: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log("Creating product:", name, quantity);
    try {
      db.execSync(
        `INSERT INTO products (name, quantity) VALUES ('${name.trim()}', ${quantity});`

      );
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

export const addProduct = (name: string, quantity: number): Promise<number> => {
  return new Promise((resolve, reject) => {
    try {
      db.execSync(
        `INSERT INTO products (name, quantity) VALUES ('${name.trim()}', ${quantity});`
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
  return new Promise(async (resolve, reject) => {
    try {
      const result = db.getAllSync('SELECT * FROM products ORDER BY `order` ASC;');
      resolve(result as Product[]);
    } catch (error: any) {
      if (error.message.includes('no such column') || error.message.includes('no such table')) {
        try {
          repairDatabaseSchema('products');
          const result = db.getAllSync('SELECT * FROM products ORDER BY `order` ASC;');
          resolve(result as Product[]); // Retry after repair
        } catch (repairError) {
          reject(repairError);
        }
      } else {
        reject(error);
      }
    }
  });
};

export const getProductHistory = (name: string): Promise<QuantityHistory[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("Getting history for product:", name);
      const product = db.getFirstSync(`SELECT id FROM products WHERE name = ?;`, [name]) as { id: number } | undefined;
      if (!product) {
        resolve([]); // Resolve with an empty array if the product is not found
        return;
      }
      const result = db.getAllSync(
        `SELECT * FROM quantity_history WHERE productId = ? ORDER BY date DESC;`,
        [product.id] // Use the product.id obtained from the query
      ) as QuantityHistory[];
      console.log("History for product:", name, result);
      resolve(result);
    } catch (error: any) {
      if (error.message.includes('no such column') || error.message.includes('no such table')) {
        try {
          repairDatabaseSchema('quantity_history');
          const product = db.getFirstSync(`SELECT id FROM products WHERE name = ?;`, [name]) as { id: number } | undefined;
          if (!product) {
            resolve([]);
            return;
          }
          const result = db.getAllSync(
            `SELECT * FROM quantity_history WHERE productId = ? ORDER BY date DESC;`,
            [product.id]
          ) as QuantityHistory[];
          resolve(result); // Retry after repair
        } catch (repairError) {
          reject(repairError);
        }
      } else {
        reject(error);
      }
    }
  });
};

export const updateProduct = (id: number, quantity: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log("Updating product:", id, quantity);   
    try {
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
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

      const products = db.getAllSync('SELECT * FROM products;') as Product[];

          products.forEach(product => {
              const existingEntry = db.getFirstSync(
                  `SELECT id FROM quantity_history WHERE productId = ${product.id} AND date >= '${todayStart}' AND date < '${todayEnd}';`
              ) as { id: number };

              if (existingEntry) {
                  db.execSync(
                      `UPDATE quantity_history SET quantity = ${product.quantity}, date = '${now.toISOString()}' WHERE id = ${existingEntry.id};`
                  );
              } else {
                  db.execSync(
                      `INSERT INTO quantity_history (productId, quantity, date) VALUES (${product.id}, ${product.quantity}, '${now.toISOString()}');`
                  );
              }
          });

      resolve();
    } catch (error) {
      console.error("Error in saveProductHistory:", error);
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

export const updateProductName = (id: number, name: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Escape single quotes in the name
      const escapedName = name.replace(/'/g, "''");
      db.execSync(
        `UPDATE products SET name = '${escapedName.trim()}' WHERE id = ${id};`
      );
      resolve();
    } catch (error) {
      console.error('Error updating product name:', error);
      reject(error);
    }
  });
};