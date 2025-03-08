import type { LoaderFunction } from "@remix-run/node";
import prisma from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export const loader: LoaderFunction = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return new Response(
      JSON.stringify({ error: "Shop parameter is required" }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const filterConfig = await prisma.filterConfig.findUnique({
      where: { shop }
    });

    return new Response(
      JSON.stringify({
        visibleMetafields: filterConfig?.visibleMetafields || [],
        includeInCollections: filterConfig?.includeInCollections || [],
        excludeFromCollections: filterConfig?.excludeFromCollections || [],
        filterSettings: filterConfig?.filterSettings || {}
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ [API] Error fetching filter config:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
}; 