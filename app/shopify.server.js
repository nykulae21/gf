import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  LATEST_API_VERSION,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  sessionExpiration: 24 * 60 * 60, // 24 ore în secunde
  hooks: {
    afterAuth: async ({ session, admin }) => {
      // Reînnoim tokenul dacă expiră în mai puțin de 5 minute
      const expiresIn = session.expires ? new Date(session.expires).getTime() - Date.now() : 0;
      if (expiresIn < 5 * 60 * 1000) {
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

          // Actualizăm sesiunea cu noul token
          if (response.ok) {
            const data = await response.json();
            if (!data.errors) {
              await shopify.sessionStorage.storeSession(session);
            }
          }
        } catch (error) {
          console.error("Eroare la reînnoirea tokenului:", error);
        }
      }
    }
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
