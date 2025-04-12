import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export const initializeDatabase = async (
  databaseName: string = "listai.db"
): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync(databaseName);
    // Initialize tables if needed here, or in an initDatabase function called elsewhere
  }
  return db;
};

const getDb = (): SQLite.SQLiteDatabase => {
  if (!db) {
    throw new Error(
      "Database has not been initialized. Call initializeDatabase() first."
    );
  }
  return db;
};

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
    { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
    { name: "name", type: "TEXT NOT NULL UNIQUE" },
    { name: "quantity", type: "INTEGER NOT NULL" },
    { name: "order", type: "INTEGER NOT NULL", default: 0 },
  ],
  quantity_history: [
    { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
    { name: "productId", type: "INTEGER NOT NULL" },
    { name: "quantity", type: "INTEGER NOT NULL" },
    { name: "date", type: "TEXT NOT NULL" },
    { name: "UNIQUE", type: "(productId, date)" },
  ],
};

const getExistingColumns = (tableName: string): string[] => {
  try {
    const result = getDb().getAllSync(`PRAGMA table_info(${tableName});`) as {
      name: string;
    }[];
    console.log("result", result);
    return result.map((columnInfo) => columnInfo.name);
  } catch (error) {
    console.error(`Error getting column info for ${tableName}:`, error);
    return [];
  }
};

const addMissingColumn = (
  tableName: string,
  columnName: string,
  columnType: string,
  defaultValue: any
) => {
  console.log(
    "Adding missing column:",
    columnName,
    columnType,
    "\ndefault:",
    defaultValue
  );
  const defaultValueClause =
    typeof defaultValue !== "undefined" ? `DEFAULT ${defaultValue}` : "";
  const alterStatement = `ALTER TABLE ${tableName} ADD COLUMN \`${columnName}\` ${columnType.replace(
    "NOT NULL",
    ""
  )}${defaultValueClause};`;
  console.log("alterStatement", alterStatement);
  getDb().execSync(alterStatement);
};

const repairDatabaseSchema = (tableName: string) => {
  console.log("Repairing database schema for table:", tableName);
  const columns = expectedSchemas[tableName];

  // Check if the table exists
  let tableExists = false;
  try {
    getDb().execSync(`SELECT 1 FROM ${tableName} LIMIT 1;`);
    tableExists = true;
  } catch (e: any) {
    if (e.message.includes("no such table")) {
      tableExists = false;
    } else {
      throw e; // Re-throw any other errors
    }
  }

  if (!tableExists) {
    const createStatement = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns
      .map((col) => `${col.name} ${col.type}`)
      .join(", ")});`;
    getDb().execSync(createStatement);
  } else {
    const existingColumns = getExistingColumns(tableName);
    console.log("existingColumns", existingColumns);
    console.log("columns", columns);
    columns.forEach((expectedColumn) => {
      if (!existingColumns.includes(expectedColumn.name)) {
        console.log(
          `Processing missing column: ${expectedColumn.name}, type: ${
            expectedColumn.type
          }, default: ${
            expectedColumn.default
          } (type: ${typeof expectedColumn.default})`
        ); // <--- ADD THIS LINE

        addMissingColumn(
          tableName,
          expectedColumn.name,
          expectedColumn.type,
          expectedColumn.default
        );
      }
    });
  }
};

export const initDatabase = () => {
  return new Promise((resolve, reject) => {
    try {
      const database = getDb();
      database.execSync(
        "CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, quantity INTEGER NOT NULL, `order` INTEGER NOT NULL DEFAULT 0);"
      );
      database.execSync(
        "CREATE TABLE IF NOT EXISTS quantity_history (id INTEGER PRIMARY KEY AUTOINCREMENT, productId INTEGER NOT NULL, quantity INTEGER NOT NULL, date TEXT NOT NULL, UNIQUE(productId, date), FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE);"
      );
      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
};

export const createProduct = (
  name: string,
  quantity: number
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      getDb().execSync(
        `INSERT INTO products (name, quantity) VALUES ('${name.trim()}', ${quantity});`
      );
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

export const addProduct = async (
  name: string,
  quantity: number
): Promise<number> => {
  const db = getDb();
  try {
    // Check if the product already exists using a parameterized query
    const existingProduct = db.getFirstSync<{ id: number }>(
      "SELECT id FROM products WHERE name = ?",
      [name] // Pass the name as a parameter
    );

    if (existingProduct) {
      return existingProduct.id;
    }
    // Insert the new product using a parameterized query
    await db.runAsync(
      "INSERT INTO products (name, quantity) VALUES (?, ?)",
      [name.trim(), quantity] // Pass name and quantity as parameters
    );

    // Get the last inserted ID
    const lastInsertedRow = db.getFirstSync<{ id: number }>(
      "SELECT last_insert_rowid() as id;"
    );

    if (lastInsertedRow && lastInsertedRow.id) {
      return lastInsertedRow.id;
    } else {
      throw new Error("Failed to get inserted ID");
    }
  } catch (error) {
    console.log("error", error);
    console.error("Error adding product:", error);
    throw new Error(error.message);
  }
};

export const getProducts = (): Promise<Product[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const database = getDb();
      const result = database.getAllSync(
        "SELECT * FROM products ORDER BY `order` ASC;"
      );
      resolve(result as Product[]);
    } catch (error: any) {
      if (
        error.message.includes("no such column") ||
        error.message.includes("no such table")
      ) {
        try {
          console.log("Repairing database schema for products table", error);
          repairDatabaseSchema("products");
          const result = getDb().getAllSync(
            "SELECT * FROM products ORDER BY `order` ASC;"
          );
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

export const getProductHistory = (
  identifier: string
): Promise<QuantityHistory[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const database = getDb();
      let query: string;
      let params: any[] = [];

      if (!isNaN(parseInt(identifier, 10))) {
        query = `SELECT * FROM quantity_history WHERE productId = ${parseInt(
          identifier,
          10
        )} ORDER BY date DESC;`;
      } else {
        const product = database.getFirstSync(
          `SELECT id FROM products WHERE name = '${identifier}';`
        ) as { id: number } | undefined;
        if (!product) {
          resolve([]);
          return;
        }
        query = `SELECT * FROM quantity_history WHERE productId = ${product.id} ORDER BY date DESC;`;
      }

      const result = database.getAllSync(query, params) as QuantityHistory[];
      resolve(result);
    } catch (error: any) {
      // ... error handling ...
    }
  });
};

export const updateProduct = (id: number, quantity: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      getDb().execSync(
        `UPDATE products SET quantity = ${quantity} WHERE id = ${id};`
      );
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

export const saveProductHistory = async (
  overrideDate?: Date
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const database = getDb();
      const now = overrideDate ? overrideDate : new Date();
      const dateToSave = now.toISOString();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).toISOString();
      const todayEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      ).toISOString();

      const latestProducts = database.getAllSync(
        "SELECT id, quantity FROM products;"
      ) as { id: number; quantity: number }[];

      latestProducts.forEach((product) => {
        const existingEntry = database.getFirstSync(
          `SELECT id FROM quantity_history WHERE productId = ${product.id} AND date >= '${todayStart}' AND date < '${todayEnd}';`
        ) as { id: number };

        if (existingEntry) {
          database.execSync(
            `UPDATE quantity_history SET quantity = ${product.quantity}, date = '${dateToSave}' WHERE id = ${existingEntry.id};`
          );
        } else {
          database.execSync(
            `INSERT INTO quantity_history (productId, quantity, date) VALUES (${product.id}, ${product.quantity}, '${dateToSave}');`
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
      getDb().execSync(`DELETE FROM products WHERE id = ${id};`);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

export const updateProductOrder = (
  updates: { id: number; order: number }[]
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const database = getDb();
      database.execSync("BEGIN TRANSACTION;");

      updates.forEach(({ id, order }) => {
        database.execSync(
          `UPDATE products SET \`order\` = ${order} WHERE id = ${id};`
        );
      });

      database.execSync("COMMIT;");
      resolve();
    } catch (error) {
      database.execSync("ROLLBACK;");
      reject(error);
    }
  });
};

export const updateProductName = (id: number, name: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const database = getDb();
      const escapedName = name.replace(/'/g, "''");
      database.execSync(
        `UPDATE products SET name = '${escapedName.trim()}' WHERE id = ${id};`
      );
      resolve();
    } catch (error) {
      console.error("Error updating product name:", error);
      reject(error);
    }
  });
};

export const saveProductHistoryForSingleProduct = async (
  productId: number,
  quantity: number,
  date: Date
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const database = getDb();
      const dateToSave = date.toISOString();
      database.execSync(
        `INSERT INTO quantity_history (productId, quantity, date) VALUES (${productId}, ${quantity}, '${dateToSave}');`
      );
      resolve();
    } catch (error) {
      console.error("Error saving history for product ID:", productId, error);
      reject(error);
    }
  });
};

export const updateProductQuantity = async (
  productId: number,
  newQuantity: number
): Promise<void> => {
  try {
    const database = getDb();
    await database.runAsync("UPDATE products SET quantity = ? WHERE id = ?", [
      newQuantity,
      productId,
    ]);
  } catch (error) {
    console.error("Error updating product quantity:", error);
    throw error;
  }
};

export const consolidateProductHistory = async (
  sourceProductId: number,
  targetProductId: number
): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  try {
    const database = getDb();
    await database.execSync(`
      BEGIN TRANSACTION;

      -- Delete any duplicate history entries for today in the target product
      DELETE FROM quantity_history
      WHERE productId = ${targetProductId}
      AND date = '${today}';

      -- Get the latest history entry from source product for today
      INSERT INTO quantity_history (productId, quantity, date)
      SELECT ${targetProductId}, quantity, date
      FROM quantity_history
      WHERE productId = ${sourceProductId}
      AND date = '${today}';

      -- Delete the source product's history
      DELETE FROM quantity_history
      WHERE productId = ${sourceProductId};

      -- Delete the source product
      DELETE FROM products
      WHERE id = ${sourceProductId};

      COMMIT;
    `);
  } catch (error) {
    console.error("Error consolidating product history:", error);
    await getDb().execSync("ROLLBACK;");
    throw error;
  }
};
