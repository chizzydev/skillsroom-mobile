import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { plainApiError } from "../../../api/errors";
import { requestWalletPayout, submitWalletTopup, walletOverview } from "../../../api/wallet";
import { AppScreen } from "../../../components/screen/AppScreen";
import { AppButton } from "../../../components/ui/AppButton";
import { Badge } from "../../../components/ui/Badge";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FormNotice } from "../../../components/ui/FormNotice";
import { SurfaceCard } from "../../../components/ui/SurfaceCard";
import { openableEvidenceUrl } from "../../../config/evidence-links";
import { colors, radius, spacing } from "../../../constants/theme";
import { EvidenceUploadField } from "../../uploads/components/EvidenceUploadField";
import type { WalletLedgerEntry, WalletPayoutRequest, WalletTopup } from "../../../types/api";

type WalletView = "overview" | "topup" | "payout" | "history";
type Notice = { tone: "error" | "success" | "info"; message: string } | null;
type WalletNotice = { view: WalletView; notice: NonNullable<Notice> } | null;

const views: WalletView[] = ["overview", "topup", "payout", "history"];
const collectionAccount = {
  bankName: "Opay",
  accountNumber: "8134979631",
  accountName: "Chizaram Anthony Chukwuka"
};

function money(minor?: number, currency = "NGN") {
  return `${currency} ${Math.round((minor ?? 0) / 100).toLocaleString()}`;
}

function amountFromNaira(value: string) {
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function viewLabel(view: WalletView) {
  if (view === "topup") return "Top-up";
  if (view === "payout") return "Payout";
  if (view === "history") return "History";
  return "Overview";
}

function topupTone(status?: string): "cyan" | "green" | "amber" | "red" | "dark" {
  if (status === "approved") return "green";
  if (status === "rejected" || status === "cancelled") return "red";
  if (status === "submitted") return "amber";
  return "cyan";
}

function payoutTone(status?: string): "cyan" | "green" | "amber" | "red" | "dark" {
  if (status === "paid") return "green";
  if (status === "rejected" || status === "failed" || status === "cancelled") return "red";
  if (status === "requested" || status === "approved") return "amber";
  return "cyan";
}

function ledgerLabel(entry: WalletLedgerEntry) {
  return String(entry.entry_type ?? "wallet update")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function topupLabel(status?: string) {
  const value = String(status ?? "").toLowerCase();
  if (value === "approved") return "Confirmed";
  if (value === "submitted") return "Receipt sent";
  if (value === "rejected") return "Resubmit";
  if (value === "cancelled") return "Cancelled";
  return String(status ?? "Pending").replaceAll("_", " ");
}

function payoutLabel(status?: string) {
  const value = String(status ?? "").toLowerCase();
  if (value === "paid") return "Paid";
  if (value === "requested") return "Requested";
  if (value === "approved") return "Processing";
  if (value === "rejected") return "Rejected";
  if (value === "failed") return "Failed";
  if (value === "cancelled") return "Cancelled";
  return String(status ?? "Pending").replaceAll("_", " ");
}

export function WalletScreen() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<WalletView>("overview");
  const [notice, setNotice] = useState<Notice>(null);
  const [localNotice, setLocalNotice] = useState<WalletNotice>(null);

  const [topupAmount, setTopupAmount] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofNote, setProofNote] = useState("");

  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutName, setPayoutName] = useState("");
  const [payoutBank, setPayoutBank] = useState("");
  const [payoutAccount, setPayoutAccount] = useState("");
  const [payoutBankCode, setPayoutBankCode] = useState("");
  const [payoutNote, setPayoutNote] = useState("");

  const walletQuery = useQuery({ queryKey: ["wallet"], queryFn: walletOverview, refetchInterval: 15000 });
  const overview = walletQuery.data;
  const account = overview?.account;
  const currency = account?.currency ?? overview?.balance?.currency ?? "NGN";
  const available = account?.available_balance_minor ?? overview?.balance?.available_minor ?? 0;
  const locked = account?.locked_balance_minor ?? overview?.balance?.locked_minor ?? 0;
  const winnings = account?.winnings_balance_minor ?? overview?.balance?.winnings_minor ?? 0;
  const topups = overview?.topups ?? [];
  const payoutRequests = overview?.payout_requests ?? [];
  const ledgerEntries = overview?.ledger_entries ?? [];
  const pendingTopups = useMemo(
    () => topups.filter((topup) => topup.status === "submitted").reduce((sum, topup) => sum + topup.amount_minor, 0),
    [topups]
  );

  const refreshWallet = async () => {
    await queryClient.invalidateQueries({ queryKey: ["wallet"] });
  };

  const notify = (targetView: WalletView, nextNotice: NonNullable<Notice>) => {
    setNotice(nextNotice);
    setLocalNotice({ view: targetView, notice: nextNotice });
  };

  const noticeFor = (targetView: WalletView) => localNotice?.view === targetView ? localNotice.notice : null;

  const topupMutation = useMutation({
    mutationFn: () => {
      const amountMinor = amountFromNaira(topupAmount);
      if (amountMinor < 10_000) throw new Error("Top-up amount must be at least NGN 100.");
      if (!proofUrl.trim()) throw new Error("Add a receipt or screenshot link before submitting.");

      return submitWalletTopup({
        amount_minor: amountMinor,
        collection_bank_name: collectionAccount.bankName,
        collection_account_number: collectionAccount.accountNumber,
        collection_account_name: collectionAccount.accountName,
        transfer_reference: transferReference.trim() || undefined,
        sender_account_name: senderName.trim() || undefined,
        sender_bank_name: senderBank.trim() || undefined,
        proof_url: proofUrl.trim(),
        proof_note: proofNote.trim() || undefined
      });
    },
    onSuccess: async () => {
      notify("topup", { tone: "success", message: "Top-up receipt submitted. Your balance will update after Skillsroom confirms the transfer." });
      setTopupAmount("");
      setTransferReference("");
      setSenderName("");
      setSenderBank("");
      setProofUrl("");
      setProofNote("");
      await refreshWallet();
    },
    onError: (error) => notify("topup", { tone: "error", message: plainApiError(error, "Could not submit top-up.") })
  });

  const payoutMutation = useMutation({
    mutationFn: () => {
      const amountMinor = amountFromNaira(payoutAmount);
      if (amountMinor < 10_000) throw new Error("Payout amount must be at least NGN 100.");
      if (amountMinor > winnings) throw new Error("Payout requests can use winnings only.");
      if (!payoutName.trim() || !payoutBank.trim() || !payoutAccount.trim()) {
        throw new Error("Enter the payout account name, bank, and account number.");
      }

      return requestWalletPayout({
        amount_minor: amountMinor,
        payout_recipient_name: payoutName.trim(),
        payout_bank_name: payoutBank.trim(),
        payout_account_number: payoutAccount.replace(/\D+/g, ""),
        payout_bank_code: payoutBankCode.trim() || undefined,
        payout_note: payoutNote.trim() || undefined
      });
    },
    onSuccess: async () => {
      notify("payout", { tone: "success", message: "Payout requested. The amount has left winnings so it cannot be requested twice." });
      setPayoutAmount("");
      setPayoutNote("");
      await refreshWallet();
    },
    onError: (error) => notify("payout", { tone: "error", message: plainApiError(error, "Could not request payout.") })
  });

  return (
    <AppScreen>
      <SurfaceCard dark>
        <Badge tone="dark">Skillsroom Balance</Badge>
        <Text style={styles.heroTitle}>{money(available, currency)}</Text>
        <Text style={styles.heroCopy}>Available balance is ready for room and tournament entry. Pending top-ups, locked entries, and winnings stay separate.</Text>
      </SurfaceCard>

      {walletQuery.isError ? <FeedbackState tone="error" title="Wallet unavailable" body="We could not load your wallet right now." actionLabel="Retry" onAction={() => void walletQuery.refetch()} /> : null}
      {notice && !noticeFor(view) ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

      <View style={styles.nav}>
        {views.map((item) => (
          <Pressable key={item} onPress={() => setView(item)} style={[styles.navButton, view === item && styles.navButtonOn]}>
            <Text style={[styles.navText, view === item && styles.navTextOn]}>{viewLabel(item)}</Text>
          </Pressable>
        ))}
      </View>

      {view === "overview" ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Available" value={money(available, currency)} detail="Ready to use" tone="green" />
            <StatCard label="Locked" value={money(locked, currency)} detail="Reserved for rooms" tone="amber" />
            <StatCard label="Winnings" value={money(winnings, currency)} detail="Payout source" tone="cyan" />
            <StatCard label="Pending" value={money(pendingTopups, currency)} detail="Not spendable" tone="red" />
          </View>
          <SurfaceCard>
            <Badge tone="amber">Money map</Badge>
            <Text style={styles.sectionTitle}>Where funds are</Text>
            <FormNotice tone="info" message="Pending top-ups are never spendable. Confirmed top-ups update your available balance after Skillsroom checks the transfer." />
            <Text style={styles.copy}>Available: ready for supported room or tournament entries.</Text>
            <Text style={styles.copy}>Locked: held for active entries until the match or tournament is finished.</Text>
            <Text style={styles.copy}>Winnings: approved winnings that can be requested for payout.</Text>
          </SurfaceCard>
          <SurfaceCard>
            <Badge>Wallet actions</Badge>
            <Text style={styles.sectionTitle}>Top up, withdraw, and track activity</Text>
            <Text style={styles.copy}>The full wallet flow is visible from Overview. The tabs above are shortcuts for when you want to focus on one task.</Text>
            <View style={styles.actionGrid}>
              <Pressable style={styles.actionCard} onPress={() => setView("topup")}>
                <Text style={styles.actionTitle}>Top-up</Text>
                <Text style={styles.copy}>Send a transfer and upload the receipt.</Text>
              </Pressable>
              <Pressable style={styles.actionCardDark} onPress={() => setView("payout")}>
                <Text style={styles.actionTitleDark}>Payout</Text>
                <Text style={styles.actionCopyDark}>Withdraw approved winnings only.</Text>
              </Pressable>
            </View>
          </SurfaceCard>
          <TopupPanel
            notice={noticeFor("topup")}
            topupAmount={topupAmount}
            transferReference={transferReference}
            senderName={senderName}
            senderBank={senderBank}
            proofUrl={proofUrl}
            proofNote={proofNote}
            loading={topupMutation.isPending}
            onTopupAmount={setTopupAmount}
            onTransferReference={setTransferReference}
            onSenderName={setSenderName}
            onSenderBank={setSenderBank}
            onProofUrl={setProofUrl}
            onProofNote={setProofNote}
            onSubmit={() => topupMutation.mutate()}
          />
          <PayoutPanel
            notice={noticeFor("payout")}
            currency={currency}
            winnings={winnings}
            payoutAmount={payoutAmount}
            payoutName={payoutName}
            payoutBank={payoutBank}
            payoutAccount={payoutAccount}
            payoutBankCode={payoutBankCode}
            payoutNote={payoutNote}
            loading={payoutMutation.isPending}
            onPayoutAmount={setPayoutAmount}
            onPayoutName={setPayoutName}
            onPayoutBank={setPayoutBank}
            onPayoutAccount={setPayoutAccount}
            onPayoutBankCode={setPayoutBankCode}
            onPayoutNote={setPayoutNote}
            onSubmit={() => payoutMutation.mutate()}
          />
          <WalletHistory topups={topups} payoutRequests={payoutRequests} ledgerEntries={ledgerEntries} />
        </>
      ) : null}

      {view === "topup" ? (
        <TopupPanel
          notice={noticeFor("topup")}
          topupAmount={topupAmount}
          transferReference={transferReference}
          senderName={senderName}
          senderBank={senderBank}
          proofUrl={proofUrl}
          proofNote={proofNote}
          loading={topupMutation.isPending}
          onTopupAmount={setTopupAmount}
          onTransferReference={setTransferReference}
          onSenderName={setSenderName}
          onSenderBank={setSenderBank}
          onProofUrl={setProofUrl}
          onProofNote={setProofNote}
          onSubmit={() => topupMutation.mutate()}
        />
      ) : null}

      {view === "payout" ? (
        <PayoutPanel
          notice={noticeFor("payout")}
          currency={currency}
          winnings={winnings}
          payoutAmount={payoutAmount}
          payoutName={payoutName}
          payoutBank={payoutBank}
          payoutAccount={payoutAccount}
          payoutBankCode={payoutBankCode}
          payoutNote={payoutNote}
          loading={payoutMutation.isPending}
          onPayoutAmount={setPayoutAmount}
          onPayoutName={setPayoutName}
          onPayoutBank={setPayoutBank}
          onPayoutAccount={setPayoutAccount}
          onPayoutBankCode={setPayoutBankCode}
          onPayoutNote={setPayoutNote}
          onSubmit={() => payoutMutation.mutate()}
        />
      ) : null}

      {view === "history" ? (
        <WalletHistory topups={topups} payoutRequests={payoutRequests} ledgerEntries={ledgerEntries} />
      ) : null}
    </AppScreen>
  );
}

function TopupPanel({
  notice,
  topupAmount,
  transferReference,
  senderName,
  senderBank,
  proofUrl,
  proofNote,
  loading,
  onTopupAmount,
  onTransferReference,
  onSenderName,
  onSenderBank,
  onProofUrl,
  onProofNote,
  onSubmit
}: {
  notice?: Notice;
  topupAmount: string;
  transferReference: string;
  senderName: string;
  senderBank: string;
  proofUrl: string;
  proofNote: string;
  loading: boolean;
  onTopupAmount: (value: string) => void;
  onTransferReference: (value: string) => void;
  onSenderName: (value: string) => void;
  onSenderBank: (value: string) => void;
  onProofUrl: (value: string) => void;
  onProofNote: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <SurfaceCard>
      <Badge tone="green">Fund balance</Badge>
      <Text style={styles.sectionTitle}>Send payment, then upload receipt</Text>
      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
      <FormNotice tone="info" message={`Transfer to ${collectionAccount.bankName} ${collectionAccount.accountNumber}, ${collectionAccount.accountName}. Pending top-ups are not spendable until confirmed.`} />
      <View style={styles.formGrid}>
        <TextInput value={topupAmount} onChangeText={onTopupAmount} keyboardType="number-pad" placeholder="Amount sent in NGN" placeholderTextColor={colors.faint} style={styles.input} />
        <TextInput value={transferReference} onChangeText={onTransferReference} placeholder="Transfer reference" placeholderTextColor={colors.faint} style={styles.input} />
        <TextInput value={senderName} onChangeText={onSenderName} placeholder="Sender account name" placeholderTextColor={colors.faint} style={styles.input} />
        <TextInput value={senderBank} onChangeText={onSenderBank} placeholder="Sender bank" placeholderTextColor={colors.faint} style={styles.input} />
      </View>
      <EvidenceUploadField contextType="wallet" contextId="wallet" label="Receipt upload" disabled={loading} onUploaded={(evidence) => onProofUrl(evidence.url)} />
      <TextInput value={proofUrl} onChangeText={onProofUrl} autoCapitalize="none" keyboardType="url" placeholder="Receipt or screenshot link" placeholderTextColor={colors.faint} style={styles.input} />
      <TextInput value={proofNote} onChangeText={onProofNote} placeholder="Note, optional" placeholderTextColor={colors.faint} style={styles.input} />
      <AppButton loading={loading} onPress={onSubmit}>Submit top-up</AppButton>
    </SurfaceCard>
  );
}

function PayoutPanel({
  notice,
  currency,
  winnings,
  payoutAmount,
  payoutName,
  payoutBank,
  payoutAccount,
  payoutBankCode,
  payoutNote,
  loading,
  onPayoutAmount,
  onPayoutName,
  onPayoutBank,
  onPayoutAccount,
  onPayoutBankCode,
  onPayoutNote,
  onSubmit
}: {
  notice?: Notice;
  currency: string;
  winnings: number;
  payoutAmount: string;
  payoutName: string;
  payoutBank: string;
  payoutAccount: string;
  payoutBankCode: string;
  payoutNote: string;
  loading: boolean;
  onPayoutAmount: (value: string) => void;
  onPayoutName: (value: string) => void;
  onPayoutBank: (value: string) => void;
  onPayoutAccount: (value: string) => void;
  onPayoutBankCode: (value: string) => void;
  onPayoutNote: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <SurfaceCard dark>
      <Badge>Winnings payout</Badge>
      <Text style={styles.darkSectionTitle}>Request payout</Text>
      <Text style={styles.darkCopy}>This uses your winnings balance only. Once submitted, that amount is removed from winnings so it cannot be requested twice.</Text>
      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
      <FormNotice tone="info" message={`You can request up to ${money(winnings, currency)}. Available balance cannot be withdrawn here.`} />
      <View style={styles.formGrid}>
        <TextInput value={payoutAmount} onChangeText={onPayoutAmount} keyboardType="number-pad" placeholder="Amount to withdraw in NGN" placeholderTextColor="#9dafc1" style={styles.darkInput} />
        <TextInput value={payoutName} onChangeText={onPayoutName} placeholder="Account name" placeholderTextColor="#9dafc1" style={styles.darkInput} />
        <TextInput value={payoutBank} onChangeText={onPayoutBank} placeholder="Bank" placeholderTextColor="#9dafc1" style={styles.darkInput} />
        <TextInput value={payoutAccount} onChangeText={onPayoutAccount} keyboardType="number-pad" placeholder="Account number" placeholderTextColor="#9dafc1" style={styles.darkInput} />
      </View>
      <TextInput value={payoutBankCode} onChangeText={onPayoutBankCode} placeholder="Bank code, optional" placeholderTextColor="#9dafc1" style={styles.darkInput} />
      <TextInput value={payoutNote} onChangeText={onPayoutNote} placeholder="Payout note" placeholderTextColor="#9dafc1" style={styles.darkInput} />
      <AppButton loading={loading} disabled={winnings <= 0} onPress={onSubmit}>Request payout</AppButton>
    </SurfaceCard>
  );
}

function WalletHistory({ topups, payoutRequests, ledgerEntries }: { topups: WalletTopup[]; payoutRequests: WalletPayoutRequest[]; ledgerEntries: WalletLedgerEntry[] }) {
  return (
    <SurfaceCard>
      <Badge>History</Badge>
      <Text style={styles.sectionTitle}>Recent wallet activity</Text>
      <Text style={styles.copy}>Top-ups, payout requests, and balance changes stay visible here.</Text>
      <HistorySection title="Payout requests" empty="No payout requests yet." rows={payoutRequests.slice(0, 5)} renderRow={(payout) => <PayoutRow payout={payout} />} compact />
      <HistorySection title="Top-ups" empty="No top-ups yet." rows={topups.slice(0, 5)} renderRow={(topup) => <TopupRow topup={topup} />} compact />
      <HistorySection title="Balance changes" empty="No balance changes yet." rows={ledgerEntries.slice(0, 6)} renderRow={(entry) => <LedgerRow entry={entry} />} compact />
    </SurfaceCard>
  );
}

function StatCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "green" | "amber" | "cyan" | "red" }) {
  return (
    <SurfaceCard style={styles.stat}>
      <Badge tone={tone}>{label}</Badge>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.copy}>{detail}</Text>
    </SurfaceCard>
  );
}

function HistorySection<T extends { id: string }>({ title, empty, rows, renderRow, compact = false }: { title: string; empty: string; rows: T[]; renderRow: (row: T) => ReactNode; compact?: boolean }) {
  const content = (
    <>
      <Badge>{title}</Badge>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.length ? rows.map((row) => renderRow(row)) : <FeedbackState title={empty} body="Wallet activity will appear here after it is recorded." />}
    </>
  );

  return compact ? <View style={styles.historyBlock}>{content}</View> : <SurfaceCard>{content}</SurfaceCard>;
}

function TopupRow({ topup }: { topup: WalletTopup }) {
  return (
    <View style={styles.row}>
      <View style={styles.fill}>
        <Text style={styles.itemTitle}>{money(topup.amount_minor, topup.currency)}</Text>
        <Text style={styles.copy}>{topup.transfer_reference ? `Reference: ${topup.transfer_reference}` : "No transfer reference"}</Text>
        {topup.review_note ? <Text style={styles.note}>{topup.review_note}</Text> : null}
      </View>
      <View style={styles.rowSide}>
        <Badge tone={topupTone(topup.status)}>{topupLabel(topup.status)}</Badge>
        {topup.proof_url ? <AppButton variant="secondary" onPress={() => {
          const url = openableEvidenceUrl(topup.proof_url);
          if (url) void Linking.openURL(url);
        }}>Receipt</AppButton> : null}
      </View>
    </View>
  );
}

function PayoutRow({ payout }: { payout: WalletPayoutRequest }) {
  return (
    <View style={styles.row}>
      <View style={styles.fill}>
        <Text style={styles.itemTitle}>{money(payout.amount_minor, payout.currency)}</Text>
        <Text style={styles.copy}>{payout.payout_bank_name ?? "Bank"} {payout.payout_account_number_masked ?? ""}</Text>
        {payout.payment_reference ? <Text style={styles.note}>Paid ref: {payout.payment_reference}</Text> : null}
        {payout.review_note ? <Text style={styles.note}>{payout.review_note}</Text> : null}
      </View>
      <Badge tone={payoutTone(payout.status)}>{payoutLabel(payout.status)}</Badge>
    </View>
  );
}

function LedgerRow({ entry }: { entry: WalletLedgerEntry }) {
  return (
    <View style={styles.row}>
      <View style={styles.fill}>
        <Text style={styles.itemTitle}>{ledgerLabel(entry)}</Text>
        <Text style={styles.copy}>{entry.bucket ?? "wallet"} - {entry.direction === "debit" ? "Used" : "Added"}</Text>
      </View>
      <Text style={[styles.ledgerAmount, entry.direction === "debit" && styles.debit]}>{entry.direction === "debit" ? "-" : "+"}{money(entry.amount_minor, entry.currency)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroTitle: { color: colors.white, fontSize: 42, lineHeight: 48, fontWeight: "900" },
  heroCopy: { color: "#c8d4e1", fontSize: 16, lineHeight: 24 },
  sectionTitle: { color: colors.ink, fontSize: 28, fontWeight: "900" },
  darkSectionTitle: { color: colors.white, fontSize: 28, lineHeight: 34, fontWeight: "900" },
  darkCopy: { color: "#c8d4e1", fontSize: 15, lineHeight: 23 },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  note: { color: colors.ink, fontSize: 13, lineHeight: 20, fontWeight: "700" },
  nav: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  navButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  navButtonOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  navText: { color: colors.muted, fontWeight: "900" },
  navTextOn: { color: colors.greenDark },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  stat: { flexBasis: "47%", flexGrow: 1, padding: spacing.md },
  value: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  actionCard: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 112,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.greenSoft,
    padding: spacing.md,
    justifyContent: "center"
  },
  actionCardDark: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 112,
    borderWidth: 1,
    borderColor: "#20344a",
    borderRadius: radius.md,
    backgroundColor: colors.navy,
    padding: spacing.md,
    justifyContent: "center"
  },
  actionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginBottom: spacing.xs },
  actionTitleDark: { color: colors.white, fontSize: 18, fontWeight: "900", marginBottom: spacing.xs },
  actionCopyDark: { color: "#c8d4e1", fontSize: 14, lineHeight: 20 },
  formGrid: { gap: spacing.sm },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surfaceAlt
  },
  darkInput: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: "#2b425a",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.white,
    backgroundColor: "#101d2d"
  },
  historyBlock: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
    marginTop: spacing.xs
  },
  row: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    backgroundColor: colors.surfaceAlt
  },
  fill: { flex: 1 },
  itemTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  rowSide: { gap: spacing.sm, alignItems: "flex-end" },
  ledgerAmount: { color: colors.greenDark, fontSize: 15, fontWeight: "900" },
  debit: { color: colors.red }
});
