import { Product } from '../database/database';

export type RootStackParamList = {
  Home: undefined;
  AddProduct: undefined;
  EditProduct: { product: Product };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
} 