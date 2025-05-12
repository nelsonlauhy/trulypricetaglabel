export async function handler(event, context) {
  const keyword = (event.queryStringParameters.keyword || "").toLowerCase();
  if (!keyword) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing search keyword" }),
    };
  }

  const SHOPIFY_DOMAIN = "trulyhealthy-ca.myshopify.com";
  const API_VERSION = "2025-04";
  const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

  const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products.json?limit=250`;

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

    // Manual filter by title or SKU (case-insensitive)
    const filtered = data.products.filter(p => {
      const title = p.title.toLowerCase();
      const sku = (p.variants[0]?.sku || "").toLowerCase();
      return title.includes(keyword) || sku.includes(keyword);
    });

    return {
      statusCode: 200,
      body: JSON.stringify(filtered),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
