import type { LoaderFunction } from "@remix-run/node";
import prisma from "../db.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export const loader: LoaderFunction = async ({ request }) => {
  console.log("🔹 [API] Visible Metafields Request received");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";

  try {
    const filterConfig = await prisma.filterConfig.findUnique({
      where: { shop }
    });

    const visibleMetafields = filterConfig?.visibleMetafields || [];
    console.log("🔍 [API] Metafielduri vizibile pentru shop-ul", shop, ":", visibleMetafields);

    return new Response(
      JSON.stringify({ success: true, visibleMetafields }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ [API] Server Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Server Error" }),
      { status: 500, headers: corsHeaders }
    );
  }
}; 