import React from 'react';
import { render, fireEvent, waitFor, screen, within, queryByTestId } from '@testing-library/react-native';
import { Alert } from 'react-native';
import HomeScreen from '../../screens/HomeScreen';
import { 
  getProducts, 
  updateProductQuantity, 
  deleteProduct 
} from '../../database/database';

// Mock the database functions
jest.mock('../../database/database', () => ({
  getProducts: jest.fn(),
  updateProductQuantity: jest.fn(),
  saveProductHistoryForSingleProduct: jest.fn(),
  deleteProduct: jest.fn(),
  updateProduct: jest.fn(),
  updateProductOrder: jest.fn(),
  saveProductHistory: jest.fn(),
  getProductHistory: jest.fn(),
  addProduct: jest.fn(),
  consolidateProductHistory: jest.fn(),
}));

// Mock the navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
    setParams: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

// Mock the Clipboard
jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  rn.Clipboard = {
    setString: jest.fn(),
  };
  return rn;
});

// Mock the DraggableFlatList
jest.mock('react-native-draggable-flatlist', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ data, renderItem }) => {
      return (
        <View testID="draggable-flatlist">
          {data.map((item, index) => (
            <View key={item.id}>{renderItem({ item, index, drag: jest.fn() })}</View>
          ))}
        </View>
      );
    },
    ScaleDecorator: ({ children }) => children,
  };
});

// At the top of the file with other mocks
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
 useNavigation: () => ({
  navigate: mockNavigate,
  addListener: jest.fn(() => jest.fn()),
  setParams: jest.fn(),
 }),
 useRoute: () => ({ // Mock useRoute here
  params: {},
 }),
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock default products
    (getProducts as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Batata', quantity: 5, order: 1 },
      { id: 2, name: 'Arroz', quantity: 3, order: 2 },
      { id: 3, name: 'Feijão', quantity: 2, order: 3 },
    ]);
  });

  test('renders correctly with products', async () => {
    const { findByText, queryByTestId } = render(<HomeScreen />);
    
    // Wait for products to load
    await findByText('Batata');
    await findByText('Arroz');
    await findByText('Feijão');
    
    // Check if the FAB button is rendered
    expect(queryByTestId('draggable-flatlist')).toBeTruthy();
  });

  test('filters products based on search query', async () => {
    const { findByText, queryByText, getByPlaceholderText } = render(<HomeScreen />);
    
    // Wait for products to load
    await findByText('Batata');
    
    // Enter search query
    const searchInput = getByPlaceholderText('Buscar produtos...');
    fireEvent.changeText(searchInput, 'Batata');
    
    // Check if only matching products are displayed
    await waitFor(() => {
      expect(queryByText('Batata')).toBeTruthy();
      expect(queryByText('Arroz')).toBeNull();
      expect(queryByText('Feijão')).toBeNull();
    });
  });

  test('handles quantity changes', async () => {
    const { findByText, getAllByTestId } = render(<HomeScreen />);
  
    // Find the increment button for the 'Batata' product
    const batataItem = await screen.findByTestId('product-item-1'); // Assuming each product item has a unique testID
    const incrementButton = within(batataItem).getByTestId('increment-button-1');
  
    // Find the quantity input for the 'Batata' product
    const quantityInput = within(batataItem).getByTestId('quantity-text-input-1');
  
    // Simulate pressing the increment button
    fireEvent.press(incrementButton);
  
    // Wait for the updateProductQuantity to be called with the correct arguments
    await waitFor(() => {
     expect(updateProductQuantity).toHaveBeenCalledWith(1, 6); // Assuming increment increases by 1
    });
  
    // Optionally, you can check if the displayed quantity has updated
    await waitFor(async () => {
     expect(within(batataItem).getByDisplayValue('6')).toBeVisible();
    });
   });


  test('handles product deletion', async () => {
    const { findByText, getAllByTestId, queryByTestId } = render(<HomeScreen />);
 
    // Mock the Alert.alert to automatically trigger the delete action
    const alertSpy = jest.spyOn(Alert, 'alert');
    alertSpy.mockImplementation((title, message, buttons) => {
     const deleteButton = buttons.find(button => button.text === 'Excluir');
     if (deleteButton && deleteButton.onPress) {
      deleteButton.onPress();
     }
     return null;
    });
 
    // Wait for the 'Batata' product to load and its delete button to be present
    const batataItem = await screen.findByTestId('product-card-1');
    const deleteButton = within(batataItem).getByTestId('delete-button-1');
 
    // Press the delete button for the 'Batata' product
    fireEvent.press(deleteButton);
 
    // Wait for the deleteProduct function to be called
    await waitFor(() => {
     expect(deleteProduct).toHaveBeenCalledWith(1);
    });
 
    // Optional: Check if the product is no longer visible
    await waitFor(async () => {
     expect(screen.queryByTestId('product-item-1')).toBeNull();
    });
 
    alertSpy.mockRestore(); // Clean up the mock
   });


  test.skip('sorts products alphabetically', async () => {
    const { findByText, getByText } = render(<HomeScreen />);
    
    // Wait for products to load
    await findByText('Batata');
    
    // Open the sort menu
    const sortButton = getByText('Ordenar');
    fireEvent.press(sortButton);
    
    // Select alphabetical sorting
    const alphabeticalOption = getByText('Alfabética');
    fireEvent.press(alphabeticalOption);
    
    // Products should be sorted alphabetically (Arroz, Batata, Feijão)
    await waitFor(() => {
      const productElements = screen.getAllByTestId('product-item');
      expect(productElements[0].props.item.name).toBe('Arroz');
      expect(productElements[1].props.item.name).toBe('Batata');
      expect(productElements[2].props.item.name).toBe('Feijão');
    });
  });

  test.skip('deletes a product', async () => {
    // Mock the database functions
    (getProducts as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Batata', quantity: 5, order: 0 },
      { id: 2, name: 'Cenoura', quantity: 3, order: 1 }
    ]);
    
    const { findByText, getAllByTestId } = render(<HomeScreen />);
    
    // Wait for products to load
    await findByText('Batata');
    
    // Find the delete buttons and press the first one
    const deleteButtons = getAllByTestId('delete-button');
    fireEvent.press(deleteButtons[0]);
    
    // Confirm deletion
    const confirmButton = await findByText('Confirmar');
    fireEvent.press(confirmButton);
    
    // Verify that deleteProduct was called with the correct ID
    expect(deleteProduct).toHaveBeenCalledWith(1);
  });

  test.skip('navigates to edit screen when a product is pressed', async () => {
    // Mock the database functions
    (getProducts as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Batata', quantity: 5, order: 0 }
    ]);
    
    const { findByText } = render(<HomeScreen />);
    
    // Wait for products to load
    const productItem = await findByText('Batata');
    
    // Press the product
    fireEvent.press(productItem);
    
    // Verify that navigation.navigate was called with the correct parameters
    expect(navigation.navigate).toHaveBeenCalledWith('EditProduct', { productId: 1 });
  });
});

