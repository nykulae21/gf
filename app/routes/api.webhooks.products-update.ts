// app/routes/api/webhooks/products-update.ts
import type { ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { apiVersion } from "../shopify.server";
import { getAccessTokenForShop } from "../sessions.server";

const prisma = new PrismaClient();
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_API_SECRET!;

export const action: ActionFunction = async ({ request }) => {
  const hmacHeader = request.headers.get("X-Shopify-Hmac-Sha256") || "";
  const body = await request.text();
  const digest = crypto
    .createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(body, "utf8")
    .digest("base64");

  if (digest !== hmacHeader) {
    console.error("Webhook verificare HMAC eșuată");
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = JSON.parse(body);
  console.log("Webhook payload:", payload);

  try {
    const productIdNumeric = payload.id.toString();
    const globalProductId = `gid://shopify/Product/${productIdNumeric}`;
    const shop = request.headers.get("X-Shopify-Shop-Domain") || "";

    if (!shop) {
      console.error("Nu a fost identificat shop-ul în webhook.");
      return new Response("Bad Request", { status: 400 });
    }

    const accessToken = await getAccessTokenForShop(shop);
    if (!accessToken) {
      console.error("Nu s-a găsit accessToken pentru shop:", shop);
      return new Response("Unauthorized", { status: 401 });
    }

    const productQuery = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          vendor
          tags
          collections(first: 5) {
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
    `;
    
    const response = await fetch(
      `https://${shop}/admin/api/${apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: productQuery,
          variables: { id: globalProductId },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Shopify API Error:", response.statusText, errorText);
      return new Response("Shopify API Error", { status: response.status });
    }

    const productData = await response.json();
    const product = productData.data.product;
    if (!product) {
      console.error("Nu s-au găsit date pentru produsul cu id:", globalProductId);
      return new Response("Product not found", { status: 404 });
    }

    const title = product.title;
    const handle = product.handle;
    const vendor = product.vendor;
    const basePrice = parseFloat(product.variants?.edges?.[0]?.node?.price) || 0;

    const tags =
      Array.isArray(product.tags) && product.tags.length > 0
        ? product.tags.join(", ")
        : product.tags || null;

    const customMetafields = product.metafields.edges.map(({ node }: any) => ({
      key: node.key,
      value: node.value,
      type: node.type,
    }));

    const variants = product.variants.edges.map(({ node: variant }: any) => ({
      id: variant.id.split("/").pop(),
      title: variant.title,
      price: parseFloat(variant.price) || 0,
      sku: variant.sku,
      availableForSale: variant.availableForSale,
      metafields: variant.metafields.edges.map(({ node: mf }: any) => ({
        key: mf.key,
        value: mf.value,
        type: mf.type,
      })),
    }));

    // Extragem colecțiile produsului
    const collections = product.collections?.edges?.map(({ node }) => ({
      id: node.id.split("/").pop(),
      title: node.title,
      handle: node.handle,
    })) || [];

    const normalizedId = product.id.split("/").pop();

    // Upsert produsul în baza de date
    await prisma.product.upsert({
      where: { id_shop: { id: normalizedId, shop } },
      update: {
        title,
        handle,
        vendor,
        tags,
        price: basePrice,
        customMetafields,
        variants,
      },
      create: {
        id: normalizedId,
        shop,
        title,
        handle,
        vendor,
        tags,
        price: basePrice,
        customMetafields,
        variants,
      },
    });

    // Upsert colecțiile în baza de date și creează legătura Many-to-Many
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

    console.log(`Produsul ${normalizedId} și colecțiile sale au fost actualizate prin webhook pentru shop-ul ${shop}.`);
    return json({ success: true });
  } catch (error) {
    console.error("Eroare la procesarea webhook-ului:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
