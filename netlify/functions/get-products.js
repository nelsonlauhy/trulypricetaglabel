export async function handler(event, context) {
  const keyword = event.queryStringParameters.keyword || "";
  if (!keyword) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing search keyword" }),
    };
  }

  const SHOPIFY_DOMAIN = "trulyhealthy-ca.myshopify.com";
  const API_VERSION = "2025-04";
  const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

  const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products.json?limit=50&title=${encodeURIComponent(keyword)}`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "Shopify API error", detail: errorText }),
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


