import * as SQLite from 'expo-sqlite';
import {
  Product,
  QuantityHistory,
  // Remove individual imports, we'll mock the whole module
  // addProduct,
  // getProducts,
  // updateProductQuantity,
  // deleteProduct,
  // updateProductOrder,
  // saveProductHistory,
  // getProductHistory,
  // updateProductName,
  // saveProductHistoryForSingleProduct,
  // consolidateProductHistory,
  initializeDatabase as realInitializeDatabase, // Rename the real import
} from '../../database/database';

// Mock the entire database module
jest.mock('../../database/database', () => {
  const originalModule = jest.requireActual('../../database/database');
  return {
    ...originalModule,
    initializeDatabase: jest.fn(() => mockDb), // Mock initializeDatabase here
    addProduct: jest.fn(),
    getProducts: jest.fn(),
    updateProductQuantity: jest.fn(),
    deleteProduct: jest.fn(),
    updateProductOrder: jest.fn(),
    saveProductHistory: jest.fn(),
    getProductHistory: jest.fn(),
    updateProductName: jest.fn(),
    saveProductHistoryForSingleProduct: jest.fn(),
    consolidateProductHistory: jest.fn(),
  };
});

// Import the mocked functions
import {
  addProduct,
  getProducts,
  updateProductQuantity,
  deleteProduct,
  updateProductOrder,
  saveProductHistory,
  getProductHistory,
  updateProductName,
  saveProductHistoryForSingleProduct,
  consolidateProductHistory,
  initializeDatabase, // Now this refers to the mocked function
} from '../../database/database';

// Mock the expo-sqlite module
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
}));

// Create mock database object type
type MockDatabase = {
  transaction: jest.Mock;
  exec: jest.Mock;
  execSync: jest.Mock;
  getAllSync: jest.Mock;
  getFirstSync: jest.Mock;
};

// Create mock database object
let mockDb: MockDatabase = {
  transaction: jest.fn(),
  exec: jest.fn(),
  execSync: jest.fn(),
  getAllSync: jest.fn(),
  getFirstSync: jest.fn(),
};

describe('Database Functions', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset the mockDb object before each test
    mockDb = {
      transaction: jest.fn(),
      exec: jest.fn(),
      execSync: jest.fn(),
      getAllSync: jest.fn(),
      getFirstSync: jest.fn(),
    };
    (SQLite.openDatabaseSync as jest.Mock).mockReturnValue(mockDb);

    // We don't need to mockReturnValue here anymore, it's done in jest.mock
    // (initializeDatabase as jest.Mock).mockReturnValue(mockDb);
    initializeDatabase(); // Call the mocked initializeDatabase

    // Mock console.error to reduce test output noise
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  describe('addProduct', () => {
    test('adds a new product successfully', async () => {
      // Mock successful insertion
      mockDb.execSync.mockImplementation(() => undefined);
      mockDb.getFirstSync.mockReturnValue({ id: 123 });

      const result = await addProduct('Test Product', 5);

      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO products")
      );
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("'Test Product', 5")
      );
      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        expect.stringContaining("SELECT last_insert_rowid() as id")
      );
      expect(result).toBe(123);
    });

    test('returns existing product ID if product already exists', async () => {
      // Mock failure on first attempt (due to unique constraint)
      mockDb.execSync.mockImplementationOnce(() => {
        const error: any = new Error('UNIQUE constraint failed');
        error.errno = 19; // SQLite error code for constraint violation
        throw error;
      });

      // Mock successful retrieval of existing product
      mockDb.getFirstSync.mockReturnValue({ id: 456 });

      const result = await addProduct('Existing Product', 7); // Different quantity to ensure update

      expect(mockDb.execSync).toHaveBeenCalledTimes(2);
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO products")
      );
      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id FROM products WHERE name = 'Existing Product'")
      );
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET quantity = 7 WHERE id = 456")
      );
      expect(result).toBe(456);
    });

    test('handles SQL errors during initial insert', async () => {
      // Mock a database error during the initial insert
      const sqlError = new Error('SQL error during insert');
      mockDb.execSync.mockImplementationOnce(() => {
        throw sqlError;
      });
      mockDb.getFirstSync.mockReturnValue(null);

      await expect(addProduct('Test Product', 5)).rejects.toThrow(sqlError);
      expect(mockDb.getFirstSync).not.toHaveBeenCalledWith(
        expect.stringContaining("SELECT id FROM products WHERE name")
      );
    });

    test('handles SQL errors when checking for existing product', async () => {
      // Mock unique constraint error on insert
      mockDb.execSync.mockImplementationOnce(() => {
        const error: any = new Error('UNIQUE constraint failed');
        error.errno = 19;
        throw error;
      });

      // Mock error when fetching existing product
      const sqlError = new Error('SQL error during select');
      mockDb.getFirstSync.mockImplementationOnce(() => {
        throw sqlError;
      });

      await expect(addProduct('Existing Product', 5)).rejects.toThrow(sqlError);
    });
  });

  describe('getProducts', () => {
    test('handles SQL errors', async () => {
      // Mock a database error
      const sqlError = new Error('SQL error');
      mockDb.getAllSync.mockImplementation(() => {
        throw sqlError;
      });

      await expect(getProducts()).rejects.toThrow(sqlError);
    });

    test('retrieves products successfully', async () => {
      // Mock successful execution
      const mockProducts = [
        { id: 1, name: 'Test Product 1', quantity: 5, order: 1 },
        { id: 2, name: 'Test Product 2', quantity: 10, order: 0 },
      ];
      mockDb.getAllSync.mockReturnValue(mockProducts);

      const products = await getProducts();

      expect(products).toHaveLength(2);
      expect(products[0].name).toBe('Test Product 2'); // Ordered by 'order' ASC
      expect(products[1].name).toBe('Test Product 1');
      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        'SELECT * FROM products ORDER BY `order` ASC;'
      );
    });

    test('retries and resolves after repairing schema if "no such column" error occurs', async () => {
      const mockProducts = [
        { id: 1, name: 'Test Product', quantity: 5, order: 0 }
      ];
      mockDb.getAllSync
        .mockImplementationOnce(() => { throw new Error('SQL error: no such column: order'); })
        .mockReturnValueOnce(mockProducts);

      const products = await getProducts();
      expect(products).toEqual(mockProducts);
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining('ALTER TABLE products ADD COLUMN `order` INTEGER NOT NULL DEFAULT 0;')
      );
      expect(mockDb.getAllSync).toHaveBeenCalledTimes(2);
      expect(mockDb.getAllSync).toHaveBeenCalledWith('SELECT * FROM products ORDER BY `order` ASC;');
    });

    test('retries and resolves after repairing schema if "no such table" error occurs', async () => {
      const mockProducts = [
        { id: 1, name: 'Test Product', quantity: 5, order: 0 }
      ];
      mockDb.getAllSync
        .mockImplementationOnce(() => { throw new Error('SQL error: no such table: products'); })
        .mockReturnValueOnce(mockProducts);

      const products = await getProducts();
      expect(products).toEqual(mockProducts);
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS products')
      );
      expect(mockDb.getAllSync).toHaveBeenCalledTimes(2);
      expect(mockDb.getAllSync).toHaveBeenCalledWith('SELECT * FROM products ORDER BY `order` ASC;');
    });

    test('rejects if error occurs during schema repair', async () => {
      mockDb.getAllSync.mockImplementationOnce(() => { throw new Error('SQL error: no such table: products'); });
      mockDb.execSync.mockImplementationOnce(() => { throw new Error('SQL error during create table'); });

      await expect(getProducts()).rejects.toThrow('SQL error during create table');
      expect(mockDb.getAllSync).toHaveBeenCalledTimes(1);
      expect(mockDb.execSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateProductQuantity', () => {
    test('updates product quantity successfully', async () => {
      // Mock successful execution
      mockDb.execSync.mockReturnValue(undefined);

      await updateProductQuantity(1, 10);

      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("BEGIN TRANSACTION")
      );
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET quantity = 10 WHERE id = 1")
      );
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("COMMIT")
      );
    });

    test('handles SQL errors and rolls back transaction', async () => {
      // Mock a database error
      const sqlError = new Error('SQL error');
      mockDb.execSync
        .mockImplementationOnce(() => undefined) // BEGIN TRANSACTION
        .mockImplementationOnce(() => { throw sqlError; }) // The update fails
        .mockImplementationOnce(() => undefined); // ROLLBACK

      await expect(updateProductQuantity(1, 10)).rejects.toThrow(sqlError);
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("BEGIN TRANSACTION")
      );
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET quantity = 10 WHERE id = 1")
      );
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("ROLLBACK")
      );
    });
  });

  describe('deleteProduct', () => {
    test('deletes a product successfully', async () => {
      // Mock successful execution
      mockDb.execSync.mockReturnValue(undefined);

      await deleteProduct(1);

      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM products WHERE id = 1")
      );
    });

    test('handles SQL errors', async () => {
      // Mock a database error
      const sqlError = new Error('SQL error');
      mockDb.execSync.mockImplementation(() => {
        throw sqlError;
      });

      await expect(deleteProduct(1)).rejects.toThrow(sqlError);
    });
  });

  describe('updateProductOrder', () => {
    test('updates product order successfully', async () => {
      // Mock successful execution
      mockDb.execSync.mockReturnValue(undefined);

      const updates = [{ id: 1, order: 2 }, { id: 3, order: 1 }];
      await updateProductOrder(updates);

      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("BEGIN TRANSACTION")
      );
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET `order` = 2 WHERE id = 1")
      );
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET `order` = 1 WHERE id = 3")
      );
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("COMMIT")
      );
    });

    test('handles SQL errors and rolls back transaction', async () => {
      // Mock a database error during the second update
      const sqlError = new Error('SQL error');
      mockDb.execSync
        .mockImplementationOnce(() => undefined) // BEGIN TRANSACTION
        .mockImplementationOnce(() => undefined) // First UPDATE
        .mockImplementationOnce(() => { throw sqlError; }) // Second UPDATE fails
        .mockImplementationOnce(() => undefined); // ROLLBACK

      const updates = [{ id: 1, order: 2 }, { id: 3, order: 1 }];
      await expect(updateProductOrder(updates)).rejects.toThrow(sqlError);

      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("BEGIN TRANSACTION")
      );
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET `order` = 2 WHERE id = 1")
      );
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET `order` = 1 WHERE id = 3")
      );
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("ROLLBACK")
      );
    });
  });

  describe('getProductHistory', () => {
    test('retrieves product history by ID', async () => {
      // Mock successful execution
      const mockHistory = [
        { id: 1, productId: 1, quantity: 5, date: '2023-01-01T00:00:00.000Z' }
      ];
      mockDb.getAllSync.mockReturnValue(mockHistory);

      const history = await getProductHistory('1');

      expect(history).toEqual(mockHistory);
      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        'SELECT * FROM quantity_history WHERE productId = 1 ORDER BY date DESC;',
        []
      );
    });

    test('retrieves product history by name', async () => {
      // Mock implementations
      mockDb.getFirstSync.mockReturnValue({ id: 1 });
      const mockHistory = [
        { id: 1, productId: 1, quantity: 5, date: '2025-04-01T00:00:00.000Z' }
      ];
      mockDb.getAllSync.mockReturnValue(mockHistory);

      const result = await getProductHistory('Test Product');

      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        "SELECT id FROM products WHERE name = 'Test Product';"
      );
      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        'SELECT * FROM quantity_history WHERE productId = 1 ORDER BY date DESC;',
        []
      );
      expect(result).toEqual(mockHistory);
    });

    test('returns empty array when product not found by name', async () => {
      // Mock that no product is found
      mockDb.getFirstSync.mockReturnValue(undefined);
      mockDb.getAllSync.mockReturnValue([]);

      const result = await getProductHistory('Nonexistent Product');

      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        "SELECT id FROM products WHERE name = 'Nonexistent Product';"
      );
      expect(mockDb.getAllSync).not.toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM quantity_history')
      );
      expect(result).toEqual([]);
    });

    test('handles SQL errors', async () => {
      const sqlError = new Error('SQL error');
      mockDb.getAllSync.mockImplementation(() => {
        throw sqlError;
      });

      await expect(getProductHistory('1')).rejects.toThrow(sqlError);
    });
  });

  describe('updateProductName', () => {
    test('updates product name successfully', async () => {
      // Mock successful execution
      mockDb.execSync.mockReturnValue(undefined);

      await updateProductName(1, 'New Product Name');

      expect(mockDb.execSync).toHaveBeenCalledWith(
        "UPDATE products SET name = 'New Product Name' WHERE id = 1;"
      );
    });

    test('handles SQL errors', async () => {
      // Mock a database error
      const sqlError = new Error('SQL error');
      mockDb.execSync.mockImplementation(() => {
        throw sqlError;
      });

      await expect(updateProductName(1, 'New Product Name')).rejects.toThrow(sqlError);
    });

    test('escapes single quotes in product names', async () => {
      // Mock successful execution
      mockDb.execSync.mockReturnValue(undefined);

      await updateProductName(1, "Product's Name");

      expect(mockDb.execSync).toHaveBeenCalledWith(
        "UPDATE products SET name = 'Product''s Name' WHERE id = 1;"
      );
    });
  });

  describe('saveProductHistoryForSingleProduct', () => {
    test('saves product history successfully', async () => {
      // Mock successful execution
      mockDb.execSync.mockReturnValue(undefined);
      const mockDate = new Date('2025-04-09T10:00:00.000Z');

      await saveProductHistoryForSingleProduct(1, 5, mockDate);

      expect(mockDb.execSync).toHaveBeenCalledWith(
        "INSERT INTO quantity_history (productId, quantity, date) VALUES (1, 5, '2025-04-09T10:00:00.000Z');"
      );
    });

    test('handles SQL errors', async () => {
      // Mock a database error
      const sqlError = new Error('SQL error');
      mockDb.execSync.mockImplementation(() => {
        throw sqlError;
      });
      const mockDate = new Date();

      await expect(saveProductHistoryForSingleProduct(1, 5, mockDate)).rejects.toThrow(sqlError);
    });
  });

  
  describe('consolidateProductHistory', () => {
    test.skip('consolidates product history successfully', async () => {
      // Mock successful execution
      mockDb.execSync.mockReturnValue(undefined);
      
      await consolidateProductHistory(1, 2);
      
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("BEGIN TRANSACTION")
      );
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("COMMIT")
      );
    });
  });
});
