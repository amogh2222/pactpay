import { log, type TelemetryLog } from "../paypal/client";
export interface SupplierQuote {
  id: string;
  sku: string;
  title: string;
  brand: string;
  supplierName: string;
  supplierLocation: string;
  unitPriceUsd: number;
  moq: number;
  leadTimeDays: number;
  onTimeDeliveryRate: number;
  slaPenaltyPercent: number;
  warrantyYears: number;
  inStockCount: number;
  imageUrl: string;
  selectionScore: number;
  selectionRationale: string;
  source: "DEMO_CATALOG" | "CHANNEL3";
  termsVerified: boolean;
}
const catalog = [
  {
    key: "chair",
    title: "Ergonomic Mesh Task Chair",
    brand: "Branch",
    sku: "CHR-MESH",
    price: 385,
    image: "/products/chair.svg",
  },
  {
    key: "desk",
    title: "Dual-Motor Standing Desk",
    brand: "FlexiSpot",
    sku: "DSK-DUAL",
    price: 465,
    image: "/products/desk.svg",
  },
  {
    key: "dock",
    title: "Thunderbolt 4 Enterprise Dock",
    brand: "Kensington",
    sku: "TB4-DOCK",
    price: 219,
    image: "/products/dock.svg",
  },
  {
    key: "espresso",
    title: "Commercial Espresso System",
    brand: "Nuova Simonelli",
    sku: "ESP-COMM",
    price: 2850,
    image: "/products/espresso.svg",
  },
  {
    key: "scanner",
    title: "Industrial Handheld Barcode Scanner",
    brand: "Zebra",
    sku: "SCN-IND",
    price: 329,
    image: "/products/scanner.svg",
  },
];
export function demoQuotes(
  query: string,
  maxUnitPrice?: number,
): SupplierQuote[] {
  const text = query.toLowerCase();
  const product =
    catalog.find((p) => text.includes(p.key)) ||
    (/coffee/.test(text)
      ? catalog[3]
      : /barcode/.test(text)
        ? catalog[4]
        : catalog[0]);
  return [
    "Northline Supply Co.",
    "Meridian Workplace",
    "Pacific Contract Supply",
  ]
    .map((supplierName, i) => {
      const price = Math.round(product.price * [1, 0.94, 1.08][i] * 100) / 100;
      return {
        id: `C3-${product.sku}-${i + 1}`,
        sku: `${product.sku}-${i + 1}`,
        title: product.title,
        brand: product.brand,
        supplierName,
        supplierLocation: ["Austin, TX", "Columbus, OH", "Portland, OR"][i],
        unitPriceUsd: price,
        moq: [5, 10, 3][i],
        leadTimeDays: [4, 8, 3][i],
        onTimeDeliveryRate: [98.6, 93.2, 99.1][i],
        slaPenaltyPercent: [15, 10, 12][i],
        warrantyYears: [5, 3, 7][i],
        inStockCount: [240, 480, 120][i],
        imageUrl: product.image,
        selectionScore: Math.max(
          0,
          [96, 82, 88][i] - (maxUnitPrice && price > maxUnitPrice ? 35 : 0),
        ),
        selectionRationale:
          i === 0
            ? "Best balance of four-day delivery, 98.6% on-time history and a 15% SLA rebate."
            : i === 1
              ? "Lowest price, with a longer lead time and weaker SLA coverage."
              : "Fastest delivery and longest warranty, at a higher unit price.",
        source: "DEMO_CATALOG" as const,
        termsVerified: false,
      };
    })
    .sort((a, b) => b.selectionScore - a.selectionScore);
}
type Product = {
  id: string;
  title: string;
  brands?: { name: string }[];
  images?: { url: string }[];
  offers?: {
    domain: string;
    price: { price: number; currency: string };
    availability?: string;
  }[];
};
function normalize(products: Product[], query: string, max?: number) {
  const defaults = demoQuotes(query);
  const quotes: SupplierQuote[] = [];
  for (const product of products) {
    for (const offer of product.offers || []) {
      if (
        offer.price?.currency !== "USD" ||
        !Number.isFinite(offer.price.price) ||
        offer.price.price <= 0 ||
        offer.availability === "OutOfStock" ||
        (max && offer.price.price > max)
      )
        continue;
      if (quotes.some((q) => q.supplierName === offer.domain)) continue;
      quotes.push({
        ...defaults[quotes.length % 3],
        id: `${product.id}-${quotes.length}`,
        sku: product.id,
        title: product.title,
        brand: product.brands?.[0]?.name || "Unspecified",
        supplierName: offer.domain,
        supplierLocation: "Not supplied by Channel3",
        unitPriceUsd: offer.price.price,
        imageUrl: product.images?.[0]?.url || defaults[0].imageUrl,
        source: "CHANNEL3",
        termsVerified: false,
        selectionScore: Math.round(
          Math.min(
            100,
            Math.max(
              0,
              100 -
                (offer.price.price / (max || offer.price.price * 2)) * 25 -
                defaults[quotes.length % 3].leadTimeDays +
                defaults[quotes.length % 3].slaPenaltyPercent / 3,
            ),
          ),
        ),
        selectionRationale:
          "Live retail offer; MOQ, stock count, lead time, warranty and SLA terms are illustrative procurement assumptions pending supplier confirmation.",
      });
      if (quotes.length === 3) return quotes;
    }
  }
  return quotes;
}
export async function searchChannel3Suppliers(
  query: string,
  maxUnitPrice?: number,
): Promise<{ quotes: SupplierQuote[]; telemetry: TelemetryLog }> {
  const start = performance.now();
  const body = {
    query,
    limit: 12,
    ...(maxUnitPrice
      ? { filters: { price: { max_price: maxUnitPrice } } }
      : {}),
    config: { currency: "USD", country: "US" },
  };
  let endpoint = "https://api.trychannel3.com/v1/search";
  let failure = "";
  try {
    let products: Product[] = [];
    if (process.env.CHANNEL3_API_KEY) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.CHANNEL3_API_KEY,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Channel3 returned HTTP ${res.status}`);
      const data = await res.json();
      products = data.products || data.data || [];
    } else {
      endpoint = process.env.CHANNEL3_MCP_URL || "https://mcp.trychannel3.com/";
      if (new URL(endpoint).hostname !== "mcp.trychannel3.com")
        throw new Error("Unsupported Channel3 MCP host");
      const { Client } =
        await import("@modelcontextprotocol/sdk/client/index.js");
      const { StreamableHTTPClientTransport } =
        await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
      const client = new Client({ name: "pactpay", version: "1.0.0" });
      try {
        await client.connect(
          new StreamableHTTPClientTransport(new URL(endpoint)),
          { timeout: 10000 },
        );
        const result = await client.callTool(
          { name: "search_products", arguments: { query } },
          undefined,
          { timeout: 10000 },
        );
        const structured = result.structuredContent as
          { products?: Product[]; data?: Product[] } | undefined;
        products = structured?.products || structured?.data || [];
        if (!products.length)
          for (const item of (result.content as {
            type: string;
            text?: string;
          }[]) || []) {
            if (item.text) {
              try {
                const parsed = JSON.parse(item.text);
                products = parsed.products || parsed.data || [];
              } catch {
                /* Non-JSON MCP content is not a product schema. */
              }
            }
          }
      } finally {
        await client.close();
      }
    }
    const quotes = normalize(products, query, maxUnitPrice);
    if (quotes.length !== 3)
      throw new Error(
        "Fewer than three comparable USD vendor offers; using the disclosed wholesale scenario.",
      );
    return {
      quotes,
      telemetry: log(
        "Channel3 sourcing",
        "POST",
        endpoint,
        200,
        performance.now() - start,
        "LIVE_SANDBOX",
        body,
        { quotes, terms: "Unverified B2B assumptions" },
        "SOURCING",
      ),
    };
  } catch (e) {
    failure = e instanceof Error ? e.message : "Channel3 unavailable";
  }
  const quotes = demoQuotes(query, maxUnitPrice);
  return {
    quotes,
    telemetry: log(
      "Channel3 sourcing",
      "POST",
      endpoint,
      200,
      performance.now() - start,
      "SANDBOX_SIMULATION",
      body,
      { quotes, fallbackReason: failure },
      "SOURCING",
    ),
  };
}
