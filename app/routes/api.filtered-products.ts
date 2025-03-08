// app/routes/api.filtered-products.ts
import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import type { FilterConfig, Product, Metafield } from "../types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function shouldShowMetafield(
  metafieldKey: string,
  collectionId: string | null,
  config: {
    visibleMetafields: string[];
    includeInCollections: string[];
    excludeFromCollections: string[];
    filterSettings: Record<string, { 
      isEnabled: boolean; 
      includeCollections: string[]; 
      excludeCollections: string[];
    }>;
  }
): boolean {
  console.log("🔍 [SHOW_METAFIELD] Verificare pentru:", {
    metafieldKey,
    collectionId,
    config
  });

  // Verificăm setările specifice pentru acest metafield
  const metafieldSettings = config.filterSettings?.[metafieldKey];
  if (metafieldSettings) {
    // Dacă metafieldul este dezactivat, nu-l afișăm
    if (!metafieldSettings.isEnabled) {
      console.log("🔍 [SHOW_METAFIELD] Metafield dezactivat în setări");
      return false;
    }

    // Verificăm colecțiile de includere
    if (metafieldSettings.includeCollections?.length > 0) {
      const shouldShow = metafieldSettings.includeCollections.includes(collectionId || '');
      if (!shouldShow) {
        console.log("🔍 [SHOW_METAFIELD] Metafield nu este inclus în colecția curentă");
        return false;
      }
    }

    // Verificăm colecțiile de excludere
    if (metafieldSettings.excludeCollections?.length > 0) {
      const shouldHide = metafieldSettings.excludeCollections.includes(collectionId || '');
      if (shouldHide) {
        console.log("🔍 [SHOW_METAFIELD] Metafield este exclus din colecția curentă");
        return false;
      }
    }

    // Dacă am trecut de toate verificările și metafieldul este activ, îl afișăm
    return true;
  }

  // Verificăm configurațiile globale de includere/excludere
  const includeConfigs = config.includeInCollections.filter(inc => inc.startsWith(metafieldKey + ":"));
  if (includeConfigs.length > 0) {
    const shouldShow = includeConfigs.some(inc => {
      const includeCollectionId = inc.split(":")[1];
      return collectionId === includeCollectionId;
    });
    console.log("🔍 [SHOW_METAFIELD] Verificare includere globală:", {
      includeConfigs,
      currentCollectionId: collectionId,
      shouldShow
    });
    return shouldShow;
  }

  const excludeConfigs = config.excludeFromCollections.filter(exc => exc.startsWith(metafieldKey + ":"));
  if (excludeConfigs.length > 0) {
    const shouldShow = !excludeConfigs.some(exc => {
      const excludeCollectionId = exc.split(":")[1];
      return collectionId === excludeCollectionId;
    });
    console.log("🔍 [SHOW_METAFIELD] Verificare excludere globală:", {
      excludeConfigs,
      currentCollectionId: collectionId,
      shouldShow
    });
    return shouldShow;
  }

  // Dacă nu avem configurații specifice, folosim vizibilitatea globală
  const isVisibleGlobally = config.visibleMetafields.includes(metafieldKey);
  console.log("🔍 [SHOW_METAFIELD] Verificare vizibilitate globală:", {
    metafieldKey,
    isVisibleGlobally
  });
  
  return isVisibleGlobally;
}

async function processMetafieldFilter(metafield: MetafieldFilter) {
  switch (metafield.type) {
    case 'single_line_text_field':
      if (metafield.query_type === "array_contains") {
        return {
          customMetafields: {
            some: {
              key: metafield.key,
              value: { contains: metafield.value }
            }
          }
        };
      }
      // Pentru dropdown și alte tipuri simple
      return {
        customMetafields: {
          some: {
            key: metafield.key,
            value: metafield.value
          }
        }
      };
    // ... restul cazurilor ...
  }
}

export const loader: LoaderFunction = async ({ request }) => {
  console.log("🔹 [API] Shopify Proxy GET Request received");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";
  const collectionId = url.searchParams.get("collection") || null;
  const vendor = url.searchParams.get("vendor") || null;
  const minPrice = url.searchParams.get("minPrice") || null;
  const maxPrice = url.searchParams.get("maxPrice") || null;
  const tags = url.searchParams.getAll("tags") || [];
  const metafields = url.searchParams.getAll("metafields") || [];

  console.log("🔍 [API] Filtre primite:", { shop, collectionId, vendor, minPrice, maxPrice, tags, metafields });

  // Obținem configurația filtrelor pentru acest shop
  const filterConfig = await prisma.filterConfig.findUnique({
    where: { shop }
  }) as FilterConfig | null;

  const visibleMetafields = filterConfig?.visibleMetafields || [];
  const includeInCollections = filterConfig?.includeInCollections || [];
  const excludeFromCollections = filterConfig?.excludeFromCollections || [];
  const filterSettings = filterConfig?.filterSettings || {};

  console.log("🔍 [API] Configurație filtre:", {
    visibleMetafields,
    includeInCollections,
    excludeFromCollections,
    filterSettings
  });

  const filters: any = {
    shop
  };

  if (collectionId) {
    filters.collections = {
      some: {
        collectionId: collectionId,
      },
    };
  }

  if (vendor) {
    filters.vendor = { contains: vendor };
  }

  if (minPrice !== null || maxPrice !== null) {
    filters.price = {};
    if (minPrice !== null) filters.price.gte = parseFloat(minPrice);
    if (maxPrice !== null) filters.price.lte = parseFloat(maxPrice);
  }

  if (tags.length > 0) {
    filters.tags = { hasSome: tags };
  }

  if (metafields.length > 0) {
    filters.AND = filters.AND || [];
    console.log("🔍 [API] Metafielduri primite pentru filtrare:", metafields);
    
    for (const metafieldStr of metafields) {
      console.log("🔍 [API] Procesare string metafield:", metafieldStr);
      try {
        const metafieldData = JSON.parse(metafieldStr);
        console.log("🔍 [API] După JSON.parse:", metafieldData);

        // Verificăm dacă metafieldul ar trebui afișat în această colecție
        if (metafieldData.key && metafieldData.value) {
          if (!shouldShowMetafield(metafieldData.key, collectionId, {
                  visibleMetafields,
                  includeInCollections,
            excludeFromCollections,
            filterSettings
          })) {
            continue;
          }

          if (metafieldData.query_type === "array_contains_range") {
            console.log("🔍 [API] Procesare filtru range pentru array:", metafieldData);
            const [minStr, maxStr] = metafieldData.value.split("-");
            const min = parseFloat(minStr);
            const max = parseFloat(maxStr);

            if (!isNaN(min) && !isNaN(max)) {
              const productsInRange = await prisma.$queryRaw`
                SELECT DISTINCT p.id 
                FROM "Product" p, 
                     jsonb_array_elements(p."customMetafields") as mf 
                WHERE mf->>'key' = ${metafieldData.key}
                AND CAST(mf->>'value' AS numeric) BETWEEN ${min} AND ${max}
                AND p.shop = ${shop}
              `;

              const productIds = (productsInRange as any[]).map(p => p.id);
              
              if (productIds.length > 0) {
                filters.AND.push({
                  id: {
                    in: productIds
                  }
                });
              } else {
                filters.AND.push({
                  id: "no_results"
                });
              }
            }
          } else if (metafieldData.type === "color" || metafieldData.type === "list.color" || filterConfig?.filterSettings?.[metafieldData.key]?.displayType === "color") {
            console.log("🔍 [API] Procesare filtru culoare:", metafieldData);
            
            let colorQuery;
            if (metafieldData.type === "list.color") {
              try {
                // Pentru list.color, verificăm dacă valoarea este un array de culori
                const colorArray = JSON.parse(metafieldData.value);
                colorQuery = prisma.$queryRaw`
                  SELECT DISTINCT p.id 
                  FROM "Product" p, 
                       jsonb_array_elements(p."customMetafields") as mf 
                  WHERE mf->>'key' = ${metafieldData.key}
                  AND mf->>'type' = 'list.color'
                  AND mf->>'value' = ${metafieldData.value}
                  AND p.shop = ${shop}
                `;
              } catch (e) {
                console.error("Eroare la parsarea valorii list.color:", e);
                continue;
              }
            } else {
              // Pentru culori simple
              colorQuery = prisma.$queryRaw`
                SELECT DISTINCT p.id 
                FROM "Product" p, 
                     jsonb_array_elements(p."customMetafields") as mf 
                WHERE mf->>'key' = ${metafieldData.key}
                AND mf->>'type' = 'color'
                AND mf->>'value' = ${metafieldData.value}
                AND p.shop = ${shop}
              `;
            }

            const productsWithColor = await colorQuery;
            const productIds = (productsWithColor as any[]).map(p => p.id);
            
            if (productIds.length > 0) {
              filters.AND.push({
                id: {
                  in: productIds
                }
              });
            } else {
              filters.AND.push({
                id: "no_results"
              });
            }
          } else {
          filters.AND.push({
            customMetafields: {
              array_contains: [{
                key: metafieldData.key,
                value: metafieldData.value,
                type: metafieldData.type || "single_line_text_field"
              }]
            }
          });
          }
        }
      } catch (error) {
        console.error("❌ [API] Eroare la parsarea metafield-ului:", error);
      }
    }
  }

  console.log("🔍 [API] Query Prisma:", JSON.stringify(filters, null, 2));

  try {
    const products = await prisma.product.findMany({
      where: filters,
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
    });

    console.log("✅ [API] Produse returnate:", products.length);

    return new Response(JSON.stringify({ success: true, products }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("❌ [API] Server Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Server Error" }),
      { status: 500, headers: corsHeaders }
    );
  }
};
