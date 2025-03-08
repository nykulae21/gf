import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate, apiVersion } from "../shopify.server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const query = `
{
  products(first: 15) {
    edges {
      node {
        id
        title
        handle
        vendor
        tags
        collections(first: 5) { # Adăugăm colecțiile
          edges {
            node {
              id
              title
              handle
            }
          }
        }
        variants(first: 100) {
          edges {
            node {
              id
              title
              price
              sku
              availableForSale
              metafields(namespace: "custom", first: 100) {
                edges {
                  node {
                    key
                    value
                    type
                  }
                }
              }
            }
          }
        }
        metafields(namespace: "custom", first: 100) {
          edges {
            node {
              key
              value
              type
            }
          }
        }
      }
    }
  }
}
`;

export const loader: LoaderFunction = async ({ request }) => {
  console.log("🔹 [Loader] API Products Loader Called");

  const { session } = await authenticate.admin(request);
  if (!session) {
    console.log("❌ [Loader] No session found. Redirecting to login.");
    throw new Response("Unauthorized", { status: 401 });
  }
  const { shop, accessToken } = session;

  try {
    const response = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken!,
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log("❌ [Loader] Shopify API Error:", response.statusText, errorText);
      throw new Response("Shopify API Error", { status: response.status });
    }

    const data = await response.json();
    console.log("✅ [Loader] Shopify API Response:", JSON.stringify(data, null, 2));

    // Preluăm lista de produse din răspuns
    const productsEdges = data?.data?.products?.edges || [];
    console.log("productsEdges:", productsEdges);

    for (const { node: product } of productsEdges) {
      const customMetafields = product.metafields?.edges?.map(({ node }) => ({
        key: node.key,
        value: node.value,
        type: node.type,
      })) || [];

      const variants = product.variants?.edges?.map(({ node: variant }) => ({
        id: variant.id.split("/").pop(),
        title: variant.title,
        price: parseFloat(variant.price) || 0,
        sku: variant.sku,
        availableForSale: variant.availableForSale,
        metafields: variant.metafields?.edges?.map(({ node: mf }) => ({
          key: mf.key,
          value: mf.value,
          type: mf.type,
        })) || [],
      })) || [];

      const collections = product.collections?.edges?.map(({ node }) => ({
        id: node.id.split("/").pop(),
        title: node.title,
        handle: node.handle,
      })) || [];

      const normalizedId = product.id.split("/").pop();
      const tags = product.tags ? product.tags.join(", ") : null;

      await prisma.product.upsert({
        where: { id_shop: { id: normalizedId, shop } },
        update: {
          title: product.title,
          handle: product.handle,
          vendor: product.vendor,
          price: parseFloat(product.variants?.edges?.[0]?.node?.price) || 0,
          customMetafields,
          variants,
          tags,
        },
        create: {
          id: normalizedId,
          shop,
          title: product.title,
          handle: product.handle,
          vendor: product.vendor,
          price: parseFloat(product.variants?.edges?.[0]?.node?.price) || 0,
          customMetafields,
          variants,
          tags,
        },
      });
      
      // Adaugă colecțiile produsului în tabela pivot `ProductCollection`
      for (const collection of collections) {
        await prisma.collection.upsert({
          where: { id_shop: { id: collection.id, shop } },
          update: {
            title: collection.title,
            handle: collection.handle,
          },
          create: {
            id: collection.id,
            shop,
            title: collection.title,
            handle: collection.handle,
          },
        });
      
        await prisma.productCollection.upsert({
          where: { 
            productId_collectionId_shop: { 
              productId: normalizedId, 
              collectionId: collection.id,
              shop 
            } 
          },
          update: {},
          create: {
            productId: normalizedId,
            collectionId: collection.id,
            shop,
          },
        });
      }
      
    }

    const storedProducts = await prisma.product.findMany();

    return json({ products: storedProducts });
  } catch (error) {
    console.error("❌ [Loader] Error fetching or syncing products:", error);
    throw new Response("Internal Server Error", { status: 500 });
  }
};
