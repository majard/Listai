import { Product } from '../database/database';

export type RootStackParamList = {
  Home: { shouldRefresh?: boolean, listId?: number };
  AddProduct: undefined;
  EditProduct: { product: Product };
  Lists: undefined;
  AddList: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
} 