import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { getAccessTokenForShop } from "../sessions.server";

export const loader: LoaderFunction = async ({ request }) => {
  console.log("🔹 [API] Import Theme Templates Request");

  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");

    if (!shop) {
      console.error("❌ [API] Missing shop parameter");
      return new Response("Missing shop parameter", { status: 400 });
    }

    const accessToken = await getAccessTokenForShop(shop);
    if (!accessToken) {
      console.error("❌ [API] No accessToken found for shop:", shop);
      return new Response("Unauthorized", { status: 401 });
    }

    console.log("🔍 [API] Fetching themes for shop:", shop);

    // Obține temele din Prisma
    const themes = await prisma.theme.findMany({
      where: { shop },
    });

    if (themes.length === 0) {
      console.warn("⚠️ [API] No themes found for shop:", shop);
      return json({ success: false, error: "No themes found" });
    }

    for (const theme of themes) {
      console.log(`📂 [API] Fetching templates for theme: ${theme.name} (ID: ${theme.id})`);

      // Shopify API Request pentru a obține lista fișierelor din temă
      const response = await fetch(
        `https://${shop}/admin/api/2023-10/themes/${theme.id}/assets.json`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [API] Shopify API Error for theme ${theme.id}:`, response.statusText, errorText);
        continue;
      }

      const data = await response.json();
      const templates = data.assets.filter((asset: any) => asset.key.startsWith("templates/"));

      for (const template of templates) {
        console.log(`🔹 [API] Fetching template: ${template.key}`);

        // Obține conținutul fiecărui template
        const templateResponse = await fetch(
          `https://${shop}/admin/api/2023-10/themes/${theme.id}/assets.json?asset[key]=${template.key}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": accessToken,
            },
          }
        );

        if (!templateResponse.ok) {
          const errorText = await templateResponse.text();
          console.error(`❌ [API] Failed to fetch template content: ${template.key}`, errorText);
          continue;
        }

        const templateData = await templateResponse.json();

        // Salvează template-ul în Prisma
        await prisma.template.upsert({
          where: { id: template.key },
          update: {
            name: template.key,
            content: templateData.asset.value,
            themeId: theme.id,
          },
          create: {
            id: template.key,
            name: template.key,
            content: templateData.asset.value,
            themeId: theme.id,
          },
        });

        console.log(`✅ [API] Template saved: ${template.key}`);
      }
    }

    return json({ success: true, message: "Templates imported successfully" });
  } catch (error: any) {
    console.error("❌ [API] Server Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Server Error" }),
      { status: 500 }
    );
  }
};
