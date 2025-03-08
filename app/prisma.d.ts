import { PrismaClient } from '@prisma/client';

declare module '@prisma/client' {
  interface PrismaClient {
    filterConfig: {
      findUnique: (args: {
        where: {
          shop: string;
        };
      }) => Promise<{
        shop: string;
        visibleMetafields: string[];
        includeInCollections: string[];
        excludeFromCollections: string[];
        filterSettings: Record<string, {
          isEnabled: boolean;
          includeCollections: string[];
          excludeCollections: string[];
          filterLabel?: string;
          displayType?: 'checkbox' | 'radio' | 'range' | 'color' | 'dropdown';
          textTransform?: 'default' | 'capitalize' | 'uppercase' | 'lowercase';
          swatchSize?: '32x32' | '48x48' | '64x64';
          swatchMode?: 'square' | 'circle';
        }>;
        createdAt: Date;
        updatedAt: Date;
      } | null>;

      upsert: (args: {
        where: {
          shop: string;
        };
        create: {
          shop: string;
          visibleMetafields: string[];
          includeInCollections: string[];
          excludeFromCollections: string[];
          filterSettings: Record<string, {
            isEnabled: boolean;
            includeCollections: string[];
            excludeCollections: string[];
            filterLabel?: string;
            displayType?: 'checkbox' | 'radio' | 'range' | 'color' | 'dropdown';
            textTransform?: 'default' | 'capitalize' | 'uppercase' | 'lowercase';
            swatchSize?: '32x32' | '48x48' | '64x64';
            swatchMode?: 'square' | 'circle';
          }>;
        };
        update: {
          visibleMetafields?: string[];
          includeInCollections?: string[];
          excludeFromCollections?: string[];
          filterSettings?: Record<string, {
            isEnabled: boolean;
            includeCollections: string[];
            excludeCollections: string[];
            filterLabel?: string;
            displayType?: 'checkbox' | 'radio' | 'range' | 'color' | 'dropdown';
            textTransform?: 'default' | 'capitalize' | 'uppercase' | 'lowercase';
            swatchSize?: '32x32' | '48x48' | '64x64';
            swatchMode?: 'square' | 'circle';
          }>;
        };
      }) => Promise<{
        shop: string;
        visibleMetafields: string[];
        includeInCollections: string[];
        excludeFromCollections: string[];
        filterSettings: Record<string, {
          isEnabled: boolean;
          includeCollections: string[];
          excludeCollections: string[];
          filterLabel?: string;
          displayType?: 'checkbox' | 'radio' | 'range' | 'color' | 'dropdown';
          textTransform?: 'default' | 'capitalize' | 'uppercase' | 'lowercase';
          swatchSize?: '32x32' | '48x48' | '64x64';
          swatchMode?: 'square' | 'circle';
        }>;
        createdAt: Date;
        updatedAt: Date;
      }>;
    };
  }
} 