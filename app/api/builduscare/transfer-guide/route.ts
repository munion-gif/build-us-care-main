import { ok } from "@/lib/api-response";

export async function GET() {
  return ok({
    bankName: process.env.NEXT_PUBLIC_BANK_TRANSFER_BANK ?? "농협",
    bankAccount: process.env.NEXT_PUBLIC_BANK_TRANSFER_ACCOUNT ?? "355-0094-9209-33",
    accountHolder: process.env.NEXT_PUBLIC_BANK_TRANSFER_HOLDER ?? "주식회사 무니온"
  });
}
