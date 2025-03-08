import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import type { ActionFunction } from "@remix-run/node";

interface ProductWebhookPayload {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  variants: any[];
  options: any[];
  status: string;
  created_at: string;
  updated_at: string;
  published_at: string;
  template_suffix: string | null;
  published_scope: string;
  tags: string;
  admin_graphql_api_id: string;
}

export const action: ActionFunction = async ({ request }) => {
  const { shop, payload } = await authenticate.webhook(request);
  const product = payload as ProductWebhookPayload;

  console.log(`Received product update webhook for ${shop}:`, product.title);

  try {
    // Actualizăm produsul în baza de date
    await prisma.product.upsert({
      where: {
        id_shop: {
          id: product.admin_graphql_api_id,
          shop
        }
      },
      update: {
        title: product.title,
        handle: product.handle,
        vendor: product.vendor,
        price: product.variants[0]?.price || 0,
        tags: product.tags,
        variants: product.variants,
        customMetafields: {} // Se actualizează separat prin alt webhook
      },
      create: {
        id: product.admin_graphql_api_id,
        shop,
        title: product.title,
        handle: product.handle,
        vendor: product.vendor,
        price: product.variants[0]?.price || 0,
        tags: product.tags,
        variants: product.variants,
        customMetafields: {}
      }
    });

    console.log(`✅ Produs actualizat cu succes: ${product.title}`);
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("❌ Eroare la actualizarea produsului:", error);
    return new Response(null, { status: 500 });
  }
}; 