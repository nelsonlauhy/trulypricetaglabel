// netlify/functions/get-products.js
export async function handler(event, context) {
  const SHOPIFY_DOMAIN = "trulyhealthy-ca.myshopify.com";
  const API_VERSION = "2025-04";
  const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

  const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products.json?limit=20`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "Failed to fetch from Shopify" }),
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data.products),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
