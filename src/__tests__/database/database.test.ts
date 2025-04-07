import * as SQLite from 'expo-sqlite';
import {
  Product,
  QuantityHistory,
  addProduct,
  getProducts,
  updateProductQuantity,
  deleteProduct,
  updateProductOrder,
  saveProductHistory,
  getProductHistory,
  updateProductName,
  saveProductHistoryForSingleProduct,
  consolidateProductHistory
} from '../../database/database';

// Mock the expo-sqlite module
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
}));

// Create mock database object
const mockDb = {
  transaction: jest.fn(),
  exec: jest.fn(),
  execSync: jest.fn(),
  getAllSync: jest.fn(),
  getFirstSync: jest.fn(),
};

// Mock openDatabaseSync to return our mock database
(SQLite.openDatabaseSync as jest.Mock).mockReturnValue(mockDb);

describe('Database Functions', () => {
  let mockDb: any;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock console.error to reduce test output noise
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Get reference to the mocked database
    mockDb = (SQLite.openDatabaseSync('listai.db') as unknown) as { 
      transaction: jest.Mock; 
      exec: jest.Mock; 
      execSync: jest.Mock; 
      getAllSync: jest.Mock; 
      getFirstSync: jest.Mock; 
    };
  });

  describe('addProduct', () => {
    test.skip('adds a new product successfully', async () => {
      // Mock successful insertion
      mockDb.execSync.mockImplementation(() => undefined);
      mockDb.getFirstSync.mockReturnValue({ id: 123 });
      
      const result = await addProduct('Test Product', 5);
      
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO products")
      );
      expect(result).toBe(123);
    });

    test.skip('returns existing product ID if product already exists', async () => {
      // Mock failure on first attempt (due to unique constraint)
      mockDb.execSync.mockImplementationOnce(() => {
        throw new Error('UNIQUE constraint failed');
      });
      
      // Mock successful retrieval of existing product
      mockDb.getFirstSync.mockReturnValue({ id: 456 });
      
      const result = await addProduct('Existing Product', 5);
      
      expect(mockDb.getFirstSync).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id FROM products WHERE name")
      );
      expect(result).toBe(456);
    });

    test.skip('handles SQL errors', async () => {
      // Mock a database error
      mockDb.execSync.mockImplementation(() => {
        throw new Error('SQL error');
      });
      
      // Mock failure to find existing product
      mockDb.getFirstSync.mockReturnValue(null);
      
      await expect(addProduct('Test Product', 5)).rejects.toThrow('SQL error');
    });
  });

  describe('getProducts', () => {
    test.skip('handles SQL errors', async () => {
      // Mock a database error
      mockDb.getAllSync.mockImplementation(() => {
        throw new Error('SQL error');
      });
      
      await expect(getProducts()).rejects.toThrow('SQL error');
    });

    test.skip('retrieves products successfully', async () => {
      // Mock successful execution
      mockDb.getAllSync.mockReturnValue([
        { id: 1, name: 'Test Product', quantity: 5, order: 1 }
      ]);
      
      const products = await getProducts();
      
      expect(products).toHaveLength(1);
      expect(products[0].name).toBe('Test Product');
    });
  });

  describe('updateProductQuantity', () => {
    test.skip('updates product quantity successfully', async () => {
      // Mock successful execution
      mockDb.execSync.mockReturnValue(undefined);
      
      await updateProductQuantity(1, 10);
      
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET quantity = 10 WHERE id = 1")
      );
    });

    test.skip('handles SQL errors', async () => {
      // Mock a database error
      mockDb.execSync.mockImplementation(() => {
        throw new Error('SQL error');
      });
      
      await expect(updateProductQuantity(1, 10)).rejects.toThrow('SQL error');
    });
  });

  describe('deleteProduct', () => {
    test.skip('deletes a product successfully', async () => {
      // Mock successful execution
      mockDb.execSync.mockReturnValue(undefined);
      
      await deleteProduct(1);
      
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM products WHERE id = 1")
      );
    });

    test.skip('handles SQL errors', async () => {
      // Mock a database error
      mockDb.execSync.mockImplementation(() => {
        throw new Error('SQL error');
      });
      
      await expect(deleteProduct(1)).rejects.toThrow('SQL error');
    });
  });

  describe('updateProductOrder', () => {
    test.skip('updates product order successfully', async () => {
      // Mock successful execution
      mockDb.execSync.mockReturnValue(undefined);
      
      const updates = [{ id: 1, order: 2 }];
      await updateProductOrder(updates);
      
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET `order` = 2 WHERE id = 1")
      );
    });

    test.skip('handles SQL errors and rolls back transaction', async () => {
      // Mock a database error
      mockDb.execSync.mockImplementationOnce(() => undefined) // BEGIN TRANSACTION
        .mockImplementationOnce(() => { throw new Error('SQL error'); }); // The update fails
      
      const updates = [{ id: 1, order: 2 }];
      await expect(updateProductOrder(updates)).rejects.toThrow('SQL error');
      
      // Check if ROLLBACK was called
      expect(mockDb.execSync).toHaveBeenCalledWith('ROLLBACK;');
    });
  });

  describe('getProductHistory', () => {
    test.skip('retrieves product history by ID', async () => {
      // Mock successful execution
      mockDb.getAllSync.mockReturnValue([
        { id: 1, productId: 1, quantity: 5, date: '2023-01-01T00:00:00.000Z' }
      ]);
      
      const history = await getProductHistory('1');
      
      expect(history).toHaveLength(1);
      expect(history[0].productId).toBe(1);
    });

    test.skip('retrieves product history by name', async () => {
      // Mock implementations to return immediately
      mockDb.getAllSync.mockImplementation((sql) => {
        if (sql.includes("SELECT id FROM products")) {
          return [{ id: 1 }];
        } else if (sql.includes("SELECT * FROM quantity_history")) {
          return [{ id: 1, productId: 1, quantity: 5, date: '2025-04-01T00:00:00.000Z' }];
        }
        return [];
      });
      
      const result = await getProductHistory('Test Product');
      
      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id FROM products WHERE name = 'Test Product'")
      );
      expect(mockDb.getAllSync).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM quantity_history WHERE productId = 1")
      );
      expect(result).toEqual([{ id: 1, productId: 1, quantity: 5, date: '2025-04-01T00:00:00.000Z' }]);
    });

    test.skip('returns empty array when product not found', async () => {
      // Reset mock implementation
      mockDb.getAllSync.mockReset();
      mockDb.getAllSync.mockReturnValue([]);
      
      const result = await getProductHistory('Nonexistent Product');
      
      expect(result).toEqual([]);
    });
  });

  describe('updateProductName', () => {
    test.skip('updates product name successfully', async () => {
      // Mock successful execution
      mockDb.execSync.mockReturnValue(undefined);
      
      await updateProductName(1, 'New Product Name');
      
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET name = 'New Product Name' WHERE id = 1")
      );
    });

    test.skip('handles SQL errors', async () => {
      // Mock a database error
      mockDb.execSync.mockImplementation(() => {
        throw new Error('SQL error');
      });
      
      await expect(updateProductName(1, 'New Product Name')).rejects.toThrow('SQL error');
    });

    test.skip('escapes single quotes in product names', async () => {
      // Mock successful execution
      mockDb.execSync.mockReturnValue(undefined);
      
      await updateProductName(1, "Product's Name");
      
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE products SET name = 'Product''s Name' WHERE id = 1")
      );
    });
  });

  describe('saveProductHistoryForSingleProduct', () => {
    test.skip('saves product history successfully', async () => {
      // Mock successful execution
      mockDb.execSync.mockReturnValue(undefined);
      
      await saveProductHistoryForSingleProduct(1, 5, new Date());
      
      expect(mockDb.execSync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO quantity_history")
      );
    });

    test.skip('handles SQL errors', async () => {
      // Mock a database error
      mockDb.execSync.mockImplementation(() => {
        throw new Error('SQL error');
      });
      
      await expect(saveProductHistoryForSingleProduct(1, 5, new Date())).rejects.toThrow();
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
