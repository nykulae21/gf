import { useEffect, useState } from "react";
import { useFetcher, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
  Spinner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  // Obținem datele necesare pentru aplicație
  const response = await admin.graphql(
    `#graphql
      query {
        shop {
          name
          id
        }
      }
    `
  );
  
  const responseJson = await response.json();
  
  return {
    shop: responseJson.data.shop,
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;
  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );
  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson.data.productCreate.product,
    variant: variantResponseJson.data.productVariantsBulkUpdate.productVariants,
  };
};

export default function Index() {
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificăm dacă suntem autentificați
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        // Aici puteți adăuga logica de verificare a autentificării
        setIsLoading(false);
      } catch (error) {
        console.error("Auth error:", error);
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <Page>
        <BlockStack gap="500" align="center">
          <Spinner size="large" />
        </BlockStack>
      </Page>
    );
  }

  return (
    <Page>
      <TitleBar title="Product Filter App">
        <Button onClick={() => navigate("/app/additional")}>
          Additional Page
        </Button>
        <Button onClick={() => navigate("/app/products_query")}>
          Fetch Products
        </Button>
      </TitleBar>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Welcome to Product Filter App
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Use the navigation buttons above to access different features:
                  </Text>
                  <List>
                    <List.Item>Additional Page - Configure your filters</List.Item>
                    <List.Item>Fetch Products - View and filter your products</List.Item>
                  </List>
                </BlockStack>
                </BlockStack>
              </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
