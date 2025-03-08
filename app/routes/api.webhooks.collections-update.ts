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
  console.log("Webhook payload (collections/update):", payload);

  try {
    const collectionId = payload.id.toString();
    const collectionTitle = payload.title;
    const collectionHandle = payload.handle;
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

    // 📌 **Request suplimentar pentru a prelua produsele din colecție**
    const collectionQuery = `
      query getCollectionProducts($id: ID!) {
        collection(id: $id) {
          id
          title
          handle
          products(first: 250) {
            edges {
              node {
                id
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
          query: collectionQuery,
          variables: { id: `gid://shopify/Collection/${collectionId}` },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Shopify API Error:", response.statusText, errorText);
      return new Response("Shopify API Error", { status: response.status });
    }

    const collectionData = await response.json();
    const collection = collectionData.data.collection;
    if (!collection) {
      console.error("Nu s-au găsit date pentru colecția cu id:", collectionId);
      return new Response("Collection not found", { status: 404 });
    }

    // 📌 **Obține lista de produse din colecție**
    const productIds = collection.products.edges.map(({ node }) => node.id.split("/").pop());

    // 📌 **Upsert colecția în Prisma**
    await prisma.collection.upsert({
      where: { id_shop: { id: collectionId, shop } },
      update: {
        title: collectionTitle,
        handle: collectionHandle,
      },
      create: {
        id: collectionId,
        shop,
        title: collectionTitle,
        handle: collectionHandle,
      },
    });

    // 📌 **Ștergem produsele vechi din colecție și adăugăm cele noi**
    await prisma.productCollection.deleteMany({
      where: { collectionId, shop },
    });

    for (const productId of productIds) {
      await prisma.productCollection.upsert({
        where: { 
          productId_collectionId_shop: { 
            productId, 
            collectionId,
            shop 
          } 
        },
        update: {},
        create: {
          productId,
          collectionId,
          shop,
        },
      });
    }

    console.log(`✔ Colecția ${collectionId} și produsele sale au fost actualizate pentru shop-ul ${shop}.`);
    return json({ success: true });
  } catch (error) {
    console.error("❌ Eroare la procesarea webhook-ului collections/update:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
