import { cookies } from "next/headers";
import { formatServiceName } from "@/lib/format";
import {
  getProductLaborPrice,
  getReplacementProductCatalog,
  isProductSelectionService,
  replacementProductDisplayName
} from "@/lib/replacement-products";
import {
  BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE,
  BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE,
  localAdminOrderHistoryToAdminListItem,
  localAdminOrderToAdminListItem,
  readLocalAdminOrderHistoryCookie,
  readLocalAdminOrderCookie
} from "@/lib/builduscare-local-admin";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const ADMIN_QUOTE_SERVICE_CODES = [
  "toilet_replace",
  "basin_replace",
  "faucet_replace",
  "bidet_install",
  "ventilator_replace",
  "sash_handle",
  "door_handle",
  "silicone_repair",
  "bath_accessory"
] as const;

export function asArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function latestQuote(order: any) {
  return asArray(order?.quotes)
    .sort((a: any, b: any) => String(b?.accepted_at ?? b?.created_at ?? "").localeCompare(String(a?.accepted_at ?? a?.created_at ?? "")))[0] ?? null;
}

export function quoteItems(order: any) {
  const items = latestQuote(order)?.items;
  return Array.isArray(items) ? items : [];
}

export function productSnapshot(line: any) {
  const metadata = line?.metadata ?? {};
  return metadata.selected_replacement_product_snapshot ?? metadata.selected_replacement_product ?? null;
}

export function productLabel(line: any) {
  const product = productSnapshot(line);
  const brandModel = [product?.brand, product?.model].filter(Boolean).join(" ");
  return brandModel || product?.name || product?.categoryName || line?.item_name || formatServiceName(line?.sku);
}

export function selectedProductSummary(order: any) {
  const items = quoteItems(order);
  if (items.length > 0) {
    const first = items[0];
    const suffix = items.length > 1 ? ` 외 ${items.length - 1}개` : ` × ${Number(first.qty ?? 1)}개`;
    return `${productLabel(first)}${suffix}`;
  }

  const skus = Array.isArray(order?.skus) ? order.skus : [];
  const first = skus[0];
  return first?.item_name || formatServiceName(first?.service_type_code ?? first?.sku ?? order?.service_type_code);
}

export function customerName(order: any) {
  const customer = Array.isArray(order?.customers) ? order.customers[0] : order?.customers;
  return customer?.name ?? "-";
}

export function customerPhone(order: any) {
  const customer = Array.isArray(order?.customers) ? order.customers[0] : order?.customers;
  return customer?.phone ?? "-";
}

export function quoteNeeded(order: any) {
  return !latestQuote(order);
}

export function isVisibleOrder(order: any) {
  const serviceCode = order?.service_type_code;
  const reason = String(order?.reason ?? "");
  if (serviceCode === "photo_inquiry") return false;
  if (reason === "photo_diagnosis" || reason === "photo_check_request") return false;
  return true;
}

export function firstServiceCode(order: any) {
  const sku = Array.isArray(order?.skus) ? order.skus[0] : null;
  return sku?.service_type_code ?? sku?.metadata?.service_type_code ?? sku?.sku ?? order?.service_type_code;
}

export function buildAdminQuoteCatalogs() {
  return ADMIN_QUOTE_SERVICE_CODES.map((serviceCode) => {
    const catalog = getReplacementProductCatalog(serviceCode);
    if (!catalog) return null;
    return {
      serviceCode,
      label: formatServiceName(serviceCode),
      groups: catalog.groups.map((group) => ({
        id: group.id,
        name: group.name,
        products: group.products.map((product) => ({
          id: product.id,
          label: replacementProductDisplayName(product),
          sku: product.sku,
          image: product.image ?? "",
          price: Number(product.price ?? 0),
          laborPrice: getProductLaborPrice(serviceCode, product),
          categoryName: product.categoryName
        }))
      }))
    };
  }).filter(Boolean);
}

export function initialQuoteItems(order: any, defaultServiceCode: string) {
  const fromQuote = quoteItems(order)
    .map((item: any) => {
      const metadata = item?.metadata ?? {};
      const product = productSnapshot(item);
      const serviceTypeCode = product?.serviceCode ?? metadata.service_type_code ?? item?.sku ?? defaultServiceCode;
      const productId = metadata.selected_replacement_product_id ?? metadata.selected_toilet_product_id ?? product?.id ?? "";
      if (!isProductSelectionService(serviceTypeCode) || !productId) return null;
      return {
        serviceTypeCode,
        productId,
        qty: Math.max(1, Number(item?.qty ?? 1))
      };
    })
    .filter(Boolean);

  if (fromQuote.length > 0) return fromQuote;

  const selected = Array.isArray(order?.selected) ? order.selected : [];
  const fromSelected = selected
    .map((item: any) => {
      const serviceTypeCode = item?.serviceCode ?? defaultServiceCode;
      const productId = item?.id ?? "";
      if (!isProductSelectionService(serviceTypeCode) || !productId) return null;
      return {
        serviceTypeCode,
        productId,
        qty: Math.max(1, Number(item?.qty ?? 1))
      };
    })
    .filter(Boolean);

  if (fromSelected.length > 0) return fromSelected;

  const skus = Array.isArray(order?.skus) ? order.skus : [];
  const fromSkus = skus
    .map((item: any) => {
      const metadata = item?.metadata ?? {};
      const serviceTypeCode = item?.service_type_code ?? metadata.service_type_code ?? defaultServiceCode;
      const productId = metadata.selected_replacement_product_id ?? metadata.selected_toilet_product_id ?? "";
      if (!isProductSelectionService(serviceTypeCode) || !productId) return null;
      return {
        serviceTypeCode,
        productId,
        qty: Math.max(1, Number(item?.qty ?? 1))
      };
    })
    .filter(Boolean);

  if (fromSkus.length > 0) return fromSkus;

  return [{ serviceTypeCode: defaultServiceCode, productId: "", qty: 1 }];
}

export function manualQuoteItems(quote: any, defaultServiceCode: string) {
  const items = Array.isArray(quote?.items) ? quote.items : [];
  return items
    .map((item: any) => {
      const metadata = item?.metadata ?? {};
      const product = productSnapshot(item);
      const serviceTypeCode = product?.serviceCode ?? metadata.service_type_code ?? item?.sku ?? defaultServiceCode;
      const productId = metadata.selected_replacement_product_id ?? metadata.selected_toilet_product_id ?? product?.id ?? "";
      if (!isProductSelectionService(serviceTypeCode) || !productId) return null;
      return {
        serviceTypeCode,
        productId,
        qty: Math.max(1, Number(item?.qty ?? 1))
      };
    })
    .filter(Boolean);
}

export async function getManualQuotes() {
  if (!hasSupabaseEnv()) return { error: null, manualQuotes: [] as any[] };

  const { data, error } = await getSupabaseAdmin()
    .from("manual_quotes")
    .select(`
      id,
      quote_number,
      customer_name,
      customer_phone,
      address_text,
      items,
      total_material,
      total_labor,
      visit_fee,
      discount,
      total_final,
      converted_order_id,
      converted_at,
      created_at,
      updated_at
    `)
    .order("updated_at", { ascending: false })
    .limit(80);

  if (error) return { error: error.message, manualQuotes: [] as any[] };
  return { error: null, manualQuotes: data ?? [] };
}

export async function getManualQuote(id: string | undefined) {
  if (!id || !hasSupabaseEnv()) return { error: null, manualQuote: null as any };

  const { data, error } = await getSupabaseAdmin()
    .from("manual_quotes")
    .select(`
      id,
      quote_number,
      customer_name,
      customer_phone,
      address_text,
      items,
      total_material,
      total_labor,
      visit_fee,
      discount,
      total_final,
      converted_order_id,
      converted_at,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) return { error: error.message, manualQuote: null as any };
  return { error: null, manualQuote: data };
}

export async function getQuoteOrders() {
  if (!hasSupabaseEnv()) {
    const cookieStore = await cookies();
    const history = readLocalAdminOrderHistoryCookie(cookieStore.get(BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE)?.value);
    const localOrder = readLocalAdminOrderCookie(cookieStore.get(BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE)?.value);
    const seededOrders = history.length > 0
      ? history.map(localAdminOrderHistoryToAdminListItem)
      : localOrder
        ? [localAdminOrderToAdminListItem(localOrder)]
        : [];

    const visible = seededOrders.filter(isVisibleOrder);
    return {
      localMode: true,
      error: null,
      quoteTargets: visible.filter((order) => quoteNeeded(order)),
      quotedOrders: visible.filter((order) => !quoteNeeded(order))
    };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      service_type_code,
      reason,
      total_amount,
      created_at,
      visit_fee,
      customers(name,phone),
      homes(address_full),
      quotes(
        id,
        version,
        items,
        total_material,
        total_labor,
        total_final,
        accepted_at,
        created_at
      ),
      payments(
        id,
        status,
        amount,
        provider,
        online_payment_amount,
        onsite_payment_amount,
        total_amount,
        created_at
      ),
      skus
    `)
    .is("deleted_at", null)
    .or("is_test.is.null,is_test.eq.false")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    return {
      localMode: false,
      error: error.message,
      quoteTargets: [],
      quotedOrders: []
    };
  }

  const visible = (data ?? []).filter(isVisibleOrder);
  return {
    localMode: false,
    error: null,
    quoteTargets: visible.filter((order) => quoteNeeded(order)),
    quotedOrders: visible.filter((order) => !quoteNeeded(order))
  };
}
