export type DisplayMode = 'show_more' | 'scrollbar' | 'show_all';
export type DisplayType = 'checkbox' | 'radio' | 'range' | 'color' | 'dropdown';
export type SwatchSize = '32x32' | '48x48' | '64x64';
export type SwatchMode = 'square' | 'circle';

export interface FilterSettings {
  isEnabled: boolean;
  displayType: DisplayType;
  filterLabel: string;
  includeCollections: string[];
  excludeCollections: string[];
  textTransform: 'default' | 'capitalize' | 'uppercase' | 'lowercase';
  displayMode: 'show_all' | 'show_more' | 'scrollbar';
  hasSearchbox?: boolean;
  swatchSize?: SwatchSize;
  swatchMode?: SwatchMode;
  position: number;
}

export interface FilterConfig {
  shop: string;
  visibleMetafields: string[];
  includeInCollections: string[];
  excludeFromCollections: string[];
  filterSettings: Record<string, FilterSettings>;
}

export interface Metafield {
  key: string;
  value: string;
  type: string;
}

export interface Product {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  price: number;
  tags: string[];
  shop: string;
  customMetafields: Metafield[];
  collections: Array<{
    collection: {
      id: string;
      title: string;
      handle: string;
    };
  }>;
}

export interface MetafieldFilter {
  key: string;
  value: string;
  type: string;
  query_type?: string;
}