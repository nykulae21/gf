import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  List,
  Button,
  Text,
  Box,
  Divider,
  Badge,
  Banner,
  Select,
  Checkbox,
  InlineStack,
  ButtonGroup,
  Modal,
  ResourceList,
  ResourceItem,
  Button as PolarisButton,
  Icon,
  TextField
} from "@shopify/polaris";
import { PlusCircleIcon, DeleteIcon } from '@shopify/polaris-icons';
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState, useCallback, useEffect } from "react";
import type { FilterConfig, Product, Metafield, FilterSettings, DisplayType } from "../types";
import { FilterPreview } from "../components/FilterPreviews";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';

interface Collection {
  id: string;
  title: string;
}

interface MetafieldConfig {
  key: string;
  isVisible: boolean;
  settings: FilterSettings;
}

const defaultSettings: FilterSettings = {
  isEnabled: false,
  displayType: 'checkbox',
  includeCollections: [],
  excludeCollections: [],
  filterLabel: '',
  textTransform: 'default',
  displayMode: 'show_all',
  position: 0
};

export const loader: LoaderFunction = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // Verificăm dacă sesiunea expiră în curând
  const expiresIn = session.expires ? new Date(session.expires).getTime() - Date.now() : 0;
  if (expiresIn < 5 * 60 * 1000) { // 5 minute
    try {
      const response = await admin.graphql(`
        mutation {
          appSubscriptionCreate(
            name: "Reînnoire token",
            returnUrl: "${process.env.SHOPIFY_APP_URL}/auth",
            test: true
          ) {
            userErrors {
              field
              message
            }
            confirmationUrl
            appSubscription {
              id
            }
          }
        }
      `);

      if (response.ok) {
        const data = await response.json();
        const responseData = data as { errors?: any[] };
        if (!responseData.errors) {
          await sessionStorage.storeSession(session);
        }
      }
    } catch (error) {
      console.error("Eroare la reînnoirea tokenului:", error);
    }
  }

  // Obținem toate colecțiile
  const collections = await prisma.collection.findMany({
    where: { shop },
    select: {
      id: true,
      title: true
    }
  });

  // Obținem toate produsele pentru acest shop
  const products = await prisma.product.findMany({
    where: {
      shop
    },
    select: {
      id: true,
      title: true,
      handle: true,
      vendor: true,
      price: true,
      tags: true,
      customMetafields: true,
      collections: {
        select: {
          collection: {
            select: {
              id: true,
              title: true,
              handle: true
            }
          }
        }
      }
    }
  }) as unknown as Product[];

  // Extragem toate metafieldurile unice
  const uniqueMetafields = new Map<string, {
    key: string;
    type: string;
    values: Set<string>;
    isVisible: boolean;
  }>();

  products.forEach(product => {
    const metafields = product.customMetafields as Metafield[];
    if (Array.isArray(metafields)) {
      metafields.forEach(metafield => {
        if (metafield && typeof metafield === 'object' && metafield.key) {
          if (!uniqueMetafields.has(metafield.key)) {
            uniqueMetafields.set(metafield.key, {
              key: metafield.key,
              type: metafield.type,
              values: new Set(),
              isVisible: true
            });
          }
          if (metafield.value) {
            uniqueMetafields.get(metafield.key)?.values.add(metafield.value);
          }
        }
      });
    }
  });

  const metafieldsList = Array.from(uniqueMetafields.values()).map(item => ({
    ...item,
    values: Array.from(item.values)
  }));

  // Obținem configurația curentă din baza de date
  const config = await prisma.filterConfig.findUnique({
    where: { shop }
  });

  // Asigurăm-ne că avem valorile implicite pentru toate câmpurile
  const currentConfig: FilterConfig = {
    shop,
    visibleMetafields: (config?.visibleMetafields as string[]) || [],
    includeInCollections: (config?.includeInCollections as string[]) || [],
    excludeFromCollections: (config?.excludeFromCollections as string[]) || [],
    filterSettings: Object.fromEntries(
      Object.entries(config?.filterSettings || {}).map(([key, value], index) => [
        key,
        {
          isEnabled: value?.isEnabled ?? false,
          displayType: value?.displayType ?? 'checkbox',
          filterLabel: value?.filterLabel ?? '',
          includeCollections: value?.includeCollections ?? [],
          excludeCollections: value?.excludeCollections ?? [],
          textTransform: value?.textTransform ?? 'default',
          displayMode: value?.displayMode ?? 'show_all',
          hasSearchbox: value?.hasSearchbox ?? false,
          position: value?.position ?? index
        } satisfies FilterSettings
      ])
    )
  };

  return json({
    metafields: metafieldsList,
    collections,
    currentConfig,
    shop
  });
};

export async function action({ request }: { request: Request }) {
  const { session } = await authenticate.admin(request);
  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const { shop } = session;
  const formData = await request.formData();
  const configData = JSON.parse(formData.get("config") as string);

  // Salvăm configurația în baza de date
  await prisma.filterConfig.upsert({
    where: { shop },
    update: configData,
    create: {
      shop,
      ...configData
    }
  });

  return json({ success: true });
}

export default function Additional() {
  const { metafields, collections, currentConfig, shop } = useLoaderData<{
    metafields: Array<{
      key: string;
      type: string;
      values: string[];
      isVisible: boolean;
    }>;
    collections: Collection[];
    currentConfig: FilterConfig;
    shop: string;
  }>();

  const [metafieldConfigs, setMetafieldConfigs] = useState<MetafieldConfig[]>(
    metafields.map(m => {
      const includeConfigs = currentConfig.includeInCollections?.filter(inc => inc.startsWith(m.key + ":")) || [];
      const excludeConfigs = currentConfig.excludeFromCollections?.filter(exc => exc.startsWith(m.key + ":")) || [];
      const settings = currentConfig.filterSettings?.[m.key] || { 
        isEnabled: false, 
        displayType: 'checkbox' as const,
        includeCollections: includeConfigs.map(inc => inc.split(":")[1]),
        excludeCollections: excludeConfigs.map(exc => exc.split(":")[1]),
        textTransform: 'default',
        displayMode: 'show_all',
        hasSearchbox: false
      };

      return {
        key: m.key,
        isVisible: currentConfig.visibleMetafields?.includes(m.key) || false,
        settings
      };
    })
  );

  const [selectedMetafield, setSelectedMetafield] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempConfigs, setTempConfigs] = useState<MetafieldConfig[]>([]);
  const [filters, setFilters] = useState<FilterConfig[]>([]);

  const submit = useSubmit();

  const handleConfigChange = useCallback((key: string, changes: Partial<MetafieldConfig>) => {
    setMetafieldConfigs(prev => {
      const newConfigs = prev.map(config => {
        if (config.key === key) {
          const newSettings = { ...config.settings, ...changes.settings };
          
          // Dacă se schimbă displayType-ul și noul tip nu este swatch-text,
          // resetăm setările specifice pentru swatch
          if (newSettings.displayType !== config.settings.displayType && 
              !['checkbox', 'radio', 'range', 'color', 'dropdown'].includes(newSettings.displayType)) {
            newSettings.swatchSize = '32x32';
            newSettings.swatchMode = 'square';
          }
          
          return { ...config, ...changes, settings: newSettings };
        }
        return config;
      });

      const configData: FilterConfig = {
        shop,
        visibleMetafields: newConfigs
          .filter(c => c.settings.isEnabled)
          .map(c => c.key),
        
        includeInCollections: newConfigs
          .filter(c => 
            c.settings.isEnabled && 
            c.settings.includeCollections.length > 0
          )
          .flatMap(c => 
            c.settings.includeCollections.map(collectionId => `${c.key}:${collectionId}`)
          ),
        
        excludeFromCollections: newConfigs
          .filter(c => 
            c.settings.isEnabled && 
            c.settings.excludeCollections.length > 0
          )
          .flatMap(c => 
            c.settings.excludeCollections.map(collectionId => `${c.key}:${collectionId}`)
          ),
        
        filterSettings: Object.fromEntries(
          newConfigs.map(c => {
            const displayType = c.settings.displayType || 'checkbox';
            const swatchSize = c.settings.swatchSize || '32x32';
            const swatchMode = c.settings.swatchMode || 'square';

            const validDisplayTypes = ['checkbox', 'radio', 'range', 'color', 'dropdown'] as const;
            const validSwatchSizes = ['32x32', '48x48', '64x64'] as const;
            const validSwatchModes = ['square', 'circle'] as const;

            const settings: FilterSettings = {
              isEnabled: c.settings.isEnabled,
              displayType: validDisplayTypes.includes(displayType as any) ? displayType as FilterSettings['displayType'] : 'checkbox',
              filterLabel: c.settings.filterLabel || '',
              includeCollections: c.settings.isEnabled ? c.settings.includeCollections : [],
              excludeCollections: c.settings.isEnabled ? c.settings.excludeCollections : [],
              swatchSize: validSwatchSizes.includes(swatchSize as any) ? swatchSize as FilterSettings['swatchSize'] : '32x32',
              swatchMode: validSwatchModes.includes(swatchMode as any) ? swatchMode as FilterSettings['swatchMode'] : 'square',
              textTransform: c.settings.textTransform || 'default',
              displayMode: c.settings.displayMode || 'show_all',
              hasSearchbox: c.settings.hasSearchbox || false,
              position: c.settings.position || 0
            };

            return [c.key, settings];
          })
        ) as Record<string, FilterSettings>
      };

      // Salvăm în baza de date
      const formData = new FormData();
      formData.append("config", JSON.stringify(configData));
      submit(formData, { method: "post" });

      return newConfigs;
    });
  }, [shop, submit]);

  const handleSettingsChange = useCallback((key: string, settings: MetafieldConfig['settings']) => {
    handleConfigChange(key, { settings });
  }, [handleConfigChange]);

  const handleOpenModal = (key: string) => {
    setSelectedMetafield(key);
    setTempConfigs(metafieldConfigs);
    setShowSettingsModal(true);
  };

  const handleTempSettingsChange = (key: string, settings: Partial<FilterSettings>) => {
    if (!key) return;
    
    setTempConfigs(prev => 
      prev.map(config => {
        if (config.key === key) {
          return {
            ...config,
            settings: {
              ...config.settings,
              ...settings
            }
          };
        }
        return config;
      })
    );
  };

  const handleSaveSettings = () => {
    setMetafieldConfigs(tempConfigs);
    
    const configData = {
      visibleMetafields: tempConfigs
        .filter(c => c.settings.isEnabled)
        .map(c => c.key),
      
      includeInCollections: tempConfigs
        .filter(c => 
          c.settings.isEnabled && 
          c.settings.includeCollections.length > 0
        )
        .flatMap(c => 
          c.settings.includeCollections.map(collectionId => `${c.key}:${collectionId}`)
        ),
      
      excludeFromCollections: tempConfigs
        .filter(c => 
          c.settings.isEnabled && 
          c.settings.excludeCollections.length > 0
        )
        .flatMap(c => 
          c.settings.excludeCollections.map(collectionId => `${c.key}:${collectionId}`)
        ),
      
      filterSettings: Object.fromEntries(
        tempConfigs.map(c => {
          const displayType = c.settings.displayType || 'checkbox';
          const swatchSize = c.settings.swatchSize || '32x32';
          const swatchMode = c.settings.swatchMode || 'square';

          const validDisplayTypes = ['checkbox', 'radio', 'range', 'color', 'dropdown'] as const;
          const validSwatchSizes = ['32x32', '48x48', '64x64'] as const;
          const validSwatchModes = ['square', 'circle'] as const;

          const settings: FilterSettings = {
            isEnabled: c.settings.isEnabled,
            displayType: validDisplayTypes.includes(displayType as any) ? displayType as FilterSettings['displayType'] : 'checkbox',
            filterLabel: c.settings.filterLabel || '',
            includeCollections: c.settings.isEnabled ? c.settings.includeCollections : [],
            excludeCollections: c.settings.isEnabled ? c.settings.excludeCollections : [],
            swatchSize: validSwatchSizes.includes(swatchSize as any) ? swatchSize as FilterSettings['swatchSize'] : '32x32',
            swatchMode: validSwatchModes.includes(swatchMode as any) ? swatchMode as FilterSettings['swatchMode'] : 'square',
            textTransform: c.settings.textTransform || 'default',
            displayMode: c.settings.displayMode || 'show_all',
            hasSearchbox: c.settings.hasSearchbox || false,
            position: c.settings.position || 0
          };

          return [c.key, settings];
        })
      ) as Record<string, FilterSettings>
    };

    const formData = new FormData();
    formData.append("config", JSON.stringify(configData));
    submit(formData, { method: "post" });
    setShowSettingsModal(false);
  };

  function renderDisplayTypeSelector(currentDisplayType: string) {
    if (!selectedMetafield) return null;
    
    const currentConfig = tempConfigs.find(c => c.key === selectedMetafield)?.settings || defaultSettings;

    return (
      <BlockStack gap="200">
        <Select
          label="Tip de afișare"
          options={[
            { label: 'Checkbox', value: 'checkbox' },
            { label: 'Radio', value: 'radio' },
            { label: 'Range', value: 'range' },
            { label: 'Color', value: 'color' },
            { label: 'Dropdown', value: 'dropdown' }
          ]}
          value={currentDisplayType}
          onChange={handleDisplayTypeChange}
        />
        
        {(currentDisplayType === 'checkbox' || currentDisplayType === 'radio') && (
          <>
            <Select
              label="Mod de afișare valori"
              options={[
                { label: 'Arată toate valorile', value: 'show_all' },
                { label: 'Buton Show More', value: 'show_more' },
                { label: 'Scrollbar', value: 'scrollbar' }
              ]}
              value={currentConfig.displayMode}
              onChange={(value) => {
                handleTempSettingsChange(selectedMetafield, {
                  ...currentConfig,
                  displayMode: value as 'show_all' | 'show_more' | 'scrollbar'
                });
              }}
            />

            <Checkbox
              label="Activează căutare în filtru"
              checked={currentConfig.hasSearchbox || false}
              onChange={(checked) => {
                handleTempSettingsChange(selectedMetafield, {
                  ...currentConfig,
                  hasSearchbox: checked
                });
              }}
              helpText="Adaugă o casetă de căutare pentru filtrarea rapidă a valorilor"
            />
          </>
        )}
        
        <Select
          label="Transformare text"
          options={[
            { label: 'Default', value: 'default' },
            { label: 'Capitalized', value: 'capitalize' },
            { label: 'Uppercase', value: 'uppercase' },
            { label: 'Lowercase', value: 'lowercase' }
          ]}
          value={currentConfig.textTransform || 'default'}
          onChange={(value) => {
            handleTempSettingsChange(selectedMetafield, {
              ...currentConfig,
              textTransform: value as FilterSettings['textTransform']
            });
          }}
        />
      </BlockStack>
    );
  }

  function handleDisplayTypeChange(newDisplayType: string) {
    if (!isValidDisplayType(newDisplayType)) return;
    
    setTempConfigs(prev => {
      const newSettings = prev.map(config => {
        if (config.key === selectedMetafield) {
          return {
            ...config,
            settings: {
              ...config.settings,
              displayType: newDisplayType as DisplayType,
              displayMode: config.settings.displayMode || 'show_all'
            }
          };
        }
        return config;
      });
      
      return newSettings;
    });
  }

  function isValidDisplayType(type: string): type is DisplayType {
    return ['checkbox', 'radio', 'range', 'color', 'dropdown'].includes(type);
  }

  const renderCollectionSelector = () => {
    if (!selectedMetafield) return null;

    const defaultSettings: FilterSettings = {
      isEnabled: false,
      displayType: 'checkbox',
      includeCollections: [],
      excludeCollections: [],
      filterLabel: '',
      textTransform: 'default',
      displayMode: 'show_all',
      position: 0
    };

    const currentConfig = tempConfigs.find(c => c.key === selectedMetafield)?.settings || defaultSettings;

    const availableCollections = collections.filter(
      c => !currentConfig.includeCollections.includes(c.id) && 
          !currentConfig.excludeCollections.includes(c.id)
    );

    return (
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Text as="h3" variant="headingMd">Setări Generale</Text>
          <Button
            pressed={currentConfig.isEnabled}
            onClick={() => {
              const newIsEnabled = !currentConfig.isEnabled;
              handleTempSettingsChange(selectedMetafield, {
                ...currentConfig,
                isEnabled: newIsEnabled,
                includeCollections: newIsEnabled ? currentConfig.includeCollections : [],
                excludeCollections: newIsEnabled ? currentConfig.excludeCollections : []
              });
            }}
          >
            {currentConfig.isEnabled ? 'Activ' : 'Inactiv'}
          </Button>
        </InlineStack>

        <BlockStack gap="200">
          <Text as="h3" variant="headingMd">Nume Filtru în Pagina de Colecție</Text>
          <TextField
            label="Numele care va apărea în filtrul din pagina de colecție"
            value={currentConfig.filterLabel || ''}
            onChange={(value) => {
              handleTempSettingsChange(selectedMetafield, {
                ...currentConfig,
                filterLabel: value
              });
            }}
            autoComplete="off"
          />
        </BlockStack>

        {renderDisplayTypeSelector(currentConfig.displayType)}

        {currentConfig.isEnabled && (
          <>
            <Text as="h3" variant="headingMd">Afișează în colecțiile</Text>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Card>
                <div style={{ maxHeight: '300px', overflowY: 'scroll' }}>
                  <ResourceList
                    items={availableCollections}
                    renderItem={(collection) => (
                      <ResourceItem
                        id={collection.id}
                        onClick={() => {
                          handleTempSettingsChange(selectedMetafield, {
                            ...currentConfig,
                            includeCollections: [...currentConfig.includeCollections, collection.id]
                          });
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text as="span" variant="bodySm" truncate>{collection.title}</Text>
                          <PolarisButton
                            size="micro"
                            onClick={() => {
                              handleTempSettingsChange(selectedMetafield, {
                                ...currentConfig,
                                includeCollections: [...currentConfig.includeCollections, collection.id]
                              });
                            }}
                          >
                            +
                          </PolarisButton>
                        </div>
                      </ResourceItem>
                    )}
                  />
                </div>
              </Card>

              <Card>
                <div style={{ maxHeight: '300px', overflowY: 'scroll' }}>
                  <ResourceList
                    items={collections.filter(c => currentConfig.includeCollections.includes(c.id))}
                    renderItem={(collection) => (
                      <ResourceItem
                        id={collection.id}
                        onClick={() => {
                          handleTempSettingsChange(selectedMetafield, {
                            ...currentConfig,
                            includeCollections: currentConfig.includeCollections.filter(id => id !== collection.id)
                          });
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text as="span" variant="bodyMd" truncate>{collection.title}</Text>
                          <PolarisButton
                            size="micro"
                            onClick={() => {
                              handleTempSettingsChange(selectedMetafield, {
                                ...currentConfig,
                                includeCollections: currentConfig.includeCollections.filter(id => id !== collection.id)
                              });
                            }}
                          >
                            ×
                          </PolarisButton>
                        </div>
                      </ResourceItem>
                    )}
                  />
                </div>
              </Card>
            </div>

            <Text as="h3" variant="headingMd">Exclude din colecțiile</Text>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Card>
                <div style={{ maxHeight: '300px', overflowY: 'scroll' }}>
                  <ResourceList
                    items={availableCollections}
                    renderItem={(collection) => (
                      <ResourceItem
                        id={collection.id}
                        onClick={() => {
                          handleTempSettingsChange(selectedMetafield, {
                            ...currentConfig,
                            excludeCollections: [...currentConfig.excludeCollections, collection.id]
                          });
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text as="span" variant="bodyMd" truncate>{collection.title}</Text>
                          <PolarisButton
                            size="micro"
                            onClick={() => {
                              handleTempSettingsChange(selectedMetafield, {
                                ...currentConfig,
                                excludeCollections: [...currentConfig.excludeCollections, collection.id]
                              });
                            }}
                          >
                            +
                          </PolarisButton>
                        </div>
                      </ResourceItem>
                    )}
                  />
                </div>
              </Card>

              <Card>
                <div style={{ maxHeight: '300px', overflowY: 'scroll' }}>
                  <ResourceList
                    items={collections.filter(c => currentConfig.excludeCollections.includes(c.id))}
                    renderItem={(collection) => (
                      <ResourceItem
                        id={collection.id}
                        onClick={() => {
                          handleTempSettingsChange(selectedMetafield, {
                            ...currentConfig,
                            excludeCollections: currentConfig.excludeCollections.filter(id => id !== collection.id)
                          });
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text as="span" variant="bodyMd" truncate>{collection.title}</Text>
                          <PolarisButton
                            size="micro"
                            onClick={() => {
                              handleTempSettingsChange(selectedMetafield, {
                                ...currentConfig,
                                excludeCollections: currentConfig.excludeCollections.filter(id => id !== collection.id)
                              });
                            }}
                          >
                            ×
                          </PolarisButton>
                        </div>
                      </ResourceItem>
                    )}
                  />
                </div>
              </Card>
            </div>
          </>
        )}
      </BlockStack>
    );
  };

  // Funcție pentru reordonarea filtrelor
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(metafieldConfigs);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Actualizăm pozițiile
    const updatedItems = items.map((item, index) => ({
      ...item,
      settings: {
        ...item.settings,
        position: index + 1
      }
    }));

    setMetafieldConfigs(updatedItems);
    
    // Salvăm noua ordine în baza de date
    const configData = {
      shop,
      visibleMetafields: updatedItems
        .filter(c => c.settings.isEnabled)
        .map(c => c.key),
      includeInCollections: updatedItems
        .filter(c => c.settings.isEnabled && c.settings.includeCollections.length > 0)
        .flatMap(c => c.settings.includeCollections.map(collectionId => `${c.key}:${collectionId}`)),
      excludeFromCollections: updatedItems
        .filter(c => c.settings.isEnabled && c.settings.excludeCollections.length > 0)
        .flatMap(c => c.settings.excludeCollections.map(collectionId => `${c.key}:${collectionId}`)),
      filterSettings: Object.fromEntries(
        updatedItems.map(c => [c.key, c.settings])
      )
    };

    const formData = new FormData();
    formData.append("config", JSON.stringify(configData));
    submit(formData, { method: "post" });
  };

  return (
    <Page title="Configurare Filtre Metafielduri">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Metafielduri Disponibile
              </Text>
              <Banner title="Instrucțiuni">
                <p>Configurați vizibilitatea și comportamentul fiecărui metafield în filtrele colecțiilor. Trageți filtrele pentru a le reordona.</p>
              </Banner>
              <Divider />
              <Banner title="Instructions">
                <p>You can reorder the filters by dragging them.</p>
                <p>You can apply idependent settings for each filter by clicking on the filter and then on the settings button.</p>
              </Banner>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="filters">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                    >
                      <List type="bullet">
                        {metafieldConfigs
                          .sort((a, b) => (a.settings.position || 0) - (b.settings.position || 0))
                          .map((config, index) => {
                            const metafield = metafields.find(m => m.key === config.key);
                            if (!metafield) return null;

                            return (
                              <Draggable
                                key={config.key}
                                draggableId={config.key}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    style={{
                                      ...provided.draggableProps.style,
                                      background: snapshot.isDragging ? '#f4f6f8' : 'transparent',
                                      marginBottom: '8px'
                                    }}
                                  >
                                    <List.Item>
                                      <BlockStack gap="200">
                                        <InlineStack align="space-between">
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div
                                              {...provided.dragHandleProps}
                                              style={{
                                                cursor: 'grab',
                                                color: '#637381'
                                              }}
                                            >
                                              ⋮⋮
                                            </div>
                                            <div>
                                              <Text variant="headingSm" as="h3">
                                                {config.settings.filterLabel || config.key.split('_').map(word => 
                                                  word.charAt(0).toUpperCase() + word.slice(1)
                                                ).join(' ')}
                                              </Text>
                                              <Badge tone={metafield.type === 'single_line_text_field' ? 'success' : 'info'}>
                                                {metafield.type}
                                              </Badge>
                                              <Badge tone={config.settings.isEnabled ? "success" : "critical"}>
                                                {config.settings.isEnabled ? "Activ" : "Inactiv"}
                                              </Badge>
                                            </div>
                                          </div>
                                          <Button
                                            onClick={() => handleOpenModal(config.key)}
                                          >
                                            Setări
                                          </Button>
                                        </InlineStack>
                                      </BlockStack>
                                    </List.Item>
                                  </div>
                                )}
                              </Draggable>
                            );
                        })}
                      </List>
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Setări Filtru"
        primaryAction={{
          content: 'Salvează',
          onAction: handleSaveSettings,
        }}
        secondaryActions={[
          {
            content: 'Anulează',
            onAction: () => setShowSettingsModal(false),
          },
        ]}
        size="large"
      >
        <Modal.Section>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '1rem' }}>
              {renderCollectionSelector()}
            </div>
            <div style={{ position: 'sticky', top: '1rem' }}>
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">Preview Filtru</Text>
                  {selectedMetafield && (
                    <FilterPreview 
                      settings={tempConfigs.find(c => c.key === selectedMetafield)?.settings || defaultSettings}
                      values={metafields.find(m => m.key === selectedMetafield)?.values}
                    />
                  )}
                </BlockStack>
              </Card>
            </div>
          </div>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

async function saveFilterOrder(filters: FilterConfig[]) {
  try {
    const response = await fetch('/api/filters/reorder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filters }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to save filter order');
    }
  } catch (error) {
    console.error('Error saving filter order:', error);
    // Handle error (show toast notification, etc.)
  }
} 