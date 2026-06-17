import type { BuilduscarePublicProduct } from "@/lib/builduscare-public-products";

export type ProductSelection = {
  product: BuilduscarePublicProduct;
  selectedColor: string;
  qty: number;
};

export type OrderResult = {
  orderNumber: string;
  statusUrl?: string;
  transferUrl?: string | null;
};
