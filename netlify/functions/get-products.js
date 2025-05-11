export async function handler(event, context) {
  const SHOPIFY_DOMAIN = "trulyhealthy-ca.myshopify.com";
  const API_VERSION = "2025-04";
  const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

  let allProducts = [];
  let nextPageURL = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products.json?limit=250`;

  try {
    while (nextPageURL) {
      const response = await fetch(nextPageURL, {
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
      allProducts = allProducts.concat(data.products);

      // Look for pagination link
      const linkHeader = response.headers.get("link");
      const match = linkHeader && linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      nextPageURL = match ? match[1] : null;
    }

    return {
      statusCode: 200,
      body: JSON.stringify(allProducts),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

