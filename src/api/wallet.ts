import type { WalletLedgerEntry, WalletOverview, WalletPayoutRequest, WalletTopup } from "../types/api";
import { apiRequest } from "./client";

export async function walletOverview() {
  return apiRequest<WalletOverview>("/wallet");
}

export async function submitWalletTopup(input: {
  amount_minor: number;
  collection_bank_name: string;
  collection_account_number: string;
  collection_account_name: string;
  transfer_reference?: string;
  sender_account_name?: string;
  sender_bank_name?: string;
  proof_url: string;
  proof_note?: string;
}) {
  const data = await apiRequest<{ topup: WalletTopup }>("/wallet/topups", {
    method: "POST",
    body: input
  });
  return data.topup;
}

export async function requestWalletPayout(input: {
  amount_minor: number;
  payout_recipient_name: string;
  payout_bank_name: string;
  payout_account_number: string;
  payout_bank_code?: string;
  payout_note?: string;
}) {
  const data = await apiRequest<{ payout_request: WalletPayoutRequest; ledger_entries: WalletLedgerEntry[] }>("/wallet/payout-requests", {
    method: "POST",
    body: input
  });
  return data;
}
