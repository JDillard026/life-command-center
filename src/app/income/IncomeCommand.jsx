"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Save } from "lucide-react";
import GlassPane from "../components/GlassPane";
import { supabase } from "@/lib/supabaseClient";
import { writeAccountDelta } from "@/lib/accountLedger";
import {
  Button,
  FocusPane,
  ModalShell,
  QueuePane,
  SummaryStrip,
  Toast,
} from "./income.components";
import styles from "./IncomePage.module.css";
import {
  DEFAULT_SETTINGS,
  addDepositLedger,
  buildEditForm,
  buildIncomeSummary,
  buildQuickForm,
  buildQueueEntries,
  dateLabel,
  mapDepositRowToClient,
  mapIncomeSettingsClientToRow,
  mapIncomeSettingsRowToClient,
  money,
  monthKeyFromISO,
  niceSourceLabel,
  normalizeScheduled,
  parseMoneyInput,
  reverseDepositLedger,
  round2,
  safeNum,
  timeLabel,
  uid,
} from "./income.helpers";

function buildDefaultSettings() {
  return { ...DEFAULT_SETTINGS };
}

export default function IncomeCommand() {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [status, setStatus] = useState("");
  const [warning, setWarning] = useState("");

  const [deposits, setDeposits] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [settings, setSettings] = useState(buildDefaultSettings());

  const [queueSearch, setQueueSearch] = useState("");
  const [queueFilter, setQueueFilter] = useState("all");
  const [selectedEntryKey, setSelectedEntryKey] = useState("");
  const [tab, setTab] = useState("command");
  const [mobileSection, setMobileSection] = useState("command");

  const [openModal, setOpenModal] = useState("");
  const [busy, setBusy] = useState(false);
  const [quickForm, setQuickForm] = useState(buildQuickForm(DEFAULT_SETTINGS));
  const [editForm, setEditForm] = useState(buildEditForm(null));
  const [settingsDraft, setSettingsDraft] = useState(buildDefaultSettings());

  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(""), 3200);
    return () => clearTimeout(id);
  }, [status]);

  useEffect(() => {
    if (!warning) return;
    const id = setTimeout(() => setWarning(""), 4200);
    return () => clearTimeout(id);
  }, [warning]);

  const loadIncomePage = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setPageError("Missing Supabase environment variables.");
      return;
    }

    setLoading(true);
    setPageError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        setUserId(null);
        setDeposits([]);
        setScheduled([]);
        setAccounts([]);
        setProfiles([]);
        setLoading(false);
        return;
      }

      const uidValue = session.user.id;
      setUserId(uidValue);

      const [depositsRes, settingsRes, accountsRes, scheduledRes, profilesRes] =
        await Promise.all([
          supabase
            .from("income_deposits")
            .select("*")
            .eq("user_id", uidValue)
            .order("deposit_date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("income_settings")
            .select("*")
            .eq("user_id", uidValue)
            .maybeSingle(),
          supabase
            .from("accounts")
            .select("*")
            .eq("user_id", uidValue)
            .order("name", { ascending: true }),
          supabase
            .from("scheduled_paydays")
            .select("*")
            .eq("user_id", uidValue)
            .neq("status", "received")
            .order("pay_date", { ascending: true }),
          supabase
            .from("calendar_profiles")
            .select("*")
            .eq("user_id", uidValue)
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: true }),
        ]);

      if (depositsRes.error) throw depositsRes.error;
      if (settingsRes.error) throw settingsRes.error;

      const nextSettings = mapIncomeSettingsRowToClient(settingsRes.data);
      const nextDeposits = (depositsRes.data || []).map(mapDepositRowToClient);
      const nextAccounts = !accountsRes.error && Array.isArray(accountsRes.data)
        ? accountsRes.data.map((row) => ({
            id: String(row.id),
            name: String(row.name || row.account_name || "Account"),
            balance: Number(row.balance ?? 0) || 0,
            accountType: String(row.account_type || ""),
          }))
        : [];
      const nextScheduled = !scheduledRes.error && Array.isArray(scheduledRes.data)
        ? scheduledRes.data.map(normalizeScheduled)
        : [];
      const nextProfiles = !profilesRes.error && Array.isArray(profilesRes.data)
        ? profilesRes.data.map((row) => ({
            id: String(row.id),
            name: String(row.name || "Default"),
            isDefault: Boolean(row.is_default),
          }))
        : [];

      setDeposits(nextDeposits);
      setScheduled(nextScheduled);
      setAccounts(nextAccounts);
      setProfiles(nextProfiles);
      setSettings(nextSettings);
      setSettingsDraft(nextSettings);
      setQuickForm(buildQuickForm(nextSettings));
    } catch (err) {
      setPageError(err?.message || "Failed to load income page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!mounted) return;
      await loadIncomePage();
    }

    run();

    return () => {
      mounted = false;
    };
  }, [loadIncomePage]);

  const summary = useMemo(
    () =>
      buildIncomeSummary({
        deposits,
        scheduled,
        settings,
        viewMonth: settings.viewMonth,
      }),
    [deposits, scheduled, settings]
  );

  const queueEntries = useMemo(
    () =>
      buildQueueEntries({
        monthDeposits: summary.monthDeposits,
        scheduled: summary.upcomingScheduled,
        projectedOnly: summary.projectedOnly,
        search: queueSearch,
        filter: queueFilter,
      }),
    [summary, queueSearch, queueFilter]
  );

  useEffect(() => {
    if (!queueEntries.length) {
      setSelectedEntryKey("");
      return;
    }

    const exists = queueEntries.some((entry) => entry.key === selectedEntryKey);
    if (!exists) setSelectedEntryKey(queueEntries[0].key);
  }, [queueEntries, selectedEntryKey]);

  const selectedEntry = queueEntries.find((entry) => entry.key === selectedEntryKey) || queueEntries[0] || null;

  useEffect(() => {
    if (selectedEntryKey) setMobileSection("command");
  }, [selectedEntryKey]);

  function setDraftSetting(field, value) {
    setSettingsDraft((prev) => ({ ...prev, [field]: value }));
  }

  function resetQuickForm(mode = "received") {
    setQuickForm(buildQuickForm(settings, mode));
  }

  async function saveSettings() {
    if (!userId || !supabase || busy) return;
    setBusy(true);
    setPageError("");

    try {
      const payload = mapIncomeSettingsClientToRow(
        {
          ...settingsDraft,
          goalMonthly: safeNum(parseMoneyInput(settingsDraft.goalMonthly), 0),
          paycheckAmt: safeNum(parseMoneyInput(settingsDraft.paycheckAmt), 0),
          bonusEstimate: safeNum(parseMoneyInput(settingsDraft.bonusEstimate), 0),
        },
        userId
      );

      const { error } = await supabase.from("income_settings").upsert(payload, {
        onConflict: "user_id",
      });

      if (error) throw error;

      const nextSettings = mapIncomeSettingsRowToClient(payload);
      setSettings(nextSettings);
      setSettingsDraft(nextSettings);
      setQuickForm((prev) => ({
        ...prev,
        destinationAccountId: prev.destinationAccountId || nextSettings.defaultAccountId || "",
      }));
      setStatus("Income settings saved.");
    } catch (err) {
      setPageError(err?.message || "Failed to save income settings.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCalendarEventBySource(sourceKey, sourceId) {
    if (!userId || !sourceId) return;

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("user_id", userId)
      .eq("source", sourceKey)
      .eq("source_id", sourceId);

    if (error) throw error;
  }

  async function upsertIncomeCalendarEvent({
    sourceId,
    sourceTable,
    title,
    payDate,
    amountValue,
    noteText,
    statusValue = "scheduled",
    profileIdOverride,
    existingEventId = "",
  }) {
    if (!userId || !supabase) {
      return { ok: false, eventId: "", message: "Not logged in." };
    }

    const chosenProfileId =
      String(profileIdOverride || "").trim() ||
      String(settings.defaultProfileId || "").trim() ||
      profiles.find((profile) => profile.isDefault)?.id ||
      profiles[0]?.id ||
      "";

    if (!chosenProfileId) {
      return { ok: false, eventId: "", message: "No calendar profile found for payday event." };
    }

    const payload = {
      user_id: userId,
      profile_id: chosenProfileId,
      title: title || "Payday",
      event_date: payDate,
      event_time: settings.paydayEventTime || null,
      end_time: null,
      category: "Payday",
      flow: "income",
      amount: round2(amountValue),
      note: noteText || "",
      status: statusValue,
      color: "#22c55e",
      source: "income",
      source_id: sourceId || null,
      source_table: sourceTable || "income_deposits",
      auto_created: true,
      transaction_type: "income",
      updated_at: new Date().toISOString(),
    };

    try {
      let targetId = existingEventId;

      if (!targetId && sourceId) {
        const { data: existing } = await supabase
          .from("calendar_events")
          .select("id")
          .eq("user_id", userId)
          .eq("source", "income")
          .eq("source_id", sourceId)
          .maybeSingle();

        targetId = String(existing?.id || "");
      }

      if (targetId) {
        const { error } = await supabase
          .from("calendar_events")
          .update(payload)
          .eq("id", targetId)
          .eq("user_id", userId);

        if (error) throw error;
        return { ok: true, eventId: targetId, message: "Payday event updated." };
      }

      const insertPayload = { id: uid(), created_at: new Date().toISOString(), ...payload };
      const { data, error } = await supabase
        .from("calendar_events")
        .insert([insertPayload])
        .select("id")
        .single();

      if (error) throw error;
      return { ok: true, eventId: String(data?.id || insertPayload.id), message: "Payday event created." };
    } catch {
      return { ok: false, eventId: "", message: "Payday saved, but calendar event helper needs adjustment." };
    }
  }

  async function updateIncomeCalendarEventIfExists({ sourceId, title, payDate, amountValue, noteText }) {
    if (!userId || !sourceId) return;

    const { data: existing } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "income")
      .eq("source_id", sourceId)
      .maybeSingle();

    if (!existing?.id) return;

    await upsertIncomeCalendarEvent({
      sourceId,
      sourceTable: "income_deposits",
      title,
      payDate,
      amountValue,
      noteText,
      statusValue: "done",
      existingEventId: existing.id,
    });
  }

  async function createScheduledPayday({ payDate, expectedAmount, source, accountId, noteText, createCalendar }) {
    if (!userId || !supabase) return { ok: false, message: "Not logged in." };

    const account = accounts.find((entry) => String(entry.id) === String(accountId));
    const scheduledId = uid();

    const payload = {
      id: scheduledId,
      user_id: userId,
      pay_date: payDate,
      expected_amount: round2(expectedAmount),
      source: source || "Paycheck",
      note: noteText || "",
      account_id: accountId || null,
      account_name: account?.name || null,
      status: "scheduled",
      calendar_event_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from("scheduled_paydays")
        .insert([payload])
        .select()
        .single();

      if (error) return { ok: false, message: error.message || "Scheduled payday table is not fully wired yet." };

      let calendarEventId = "";
      let calendarMsg = "";

      if (createCalendar) {
        const cal = await upsertIncomeCalendarEvent({
          sourceId: scheduledId,
          sourceTable: "scheduled_paydays",
          title: source || "Payday",
          payDate,
          amountValue: expectedAmount,
          noteText,
          statusValue: "scheduled",
        });

        if (cal.ok && cal.eventId) {
          calendarEventId = cal.eventId;
          calendarMsg = " Calendar event created.";

          await supabase
            .from("scheduled_paydays")
            .update({ calendar_event_id: cal.eventId, updated_at: new Date().toISOString() })
            .eq("id", scheduledId)
            .eq("user_id", userId);
        } else if (cal.message) {
          setWarning(cal.message);
        }
      }

      const saved = normalizeScheduled({
        ...data,
        calendar_event_id: calendarEventId || data?.calendar_event_id || "",
      });

      setScheduled((prev) =>
        [...prev.filter((item) => item.status !== "received"), saved].sort((a, b) =>
          a.pay_date.localeCompare(b.pay_date)
        )
      );

      return { ok: true, message: `Payday scheduled.${calendarMsg}` };
    } catch (err) {
      return { ok: false, message: err?.message || "Scheduled payday helper needs adjustment." };
    }
  }

  async function submitQuickEntry() {
    if (!userId || !supabase || busy) return;

    const dt = String(quickForm.date || "").trim();
    const src = String(quickForm.source || "").trim();
    const amt = parseMoneyInput(quickForm.amount);
    const nt = String(quickForm.note || "").trim();
    const accountId = String(quickForm.destinationAccountId || "").trim();

    if (!dt) return setPageError("Date is required.");
    if (!src) return setPageError("Source is required.");
    if (!Number.isFinite(amt) || amt <= 0) return setPageError("Amount must be greater than 0.");

    setBusy(true);
    setPageError("");
    setWarning("");

    try {
      if (quickForm.mode === "scheduled") {
        const scheduledResult = await createScheduledPayday({
          payDate: dt,
          expectedAmount: amt,
          source: src,
          accountId,
          noteText: nt,
          createCalendar: quickForm.createCalendarEvent || settings.autoCreateCalendar,
        });

        if (scheduledResult.ok) {
          setStatus(scheduledResult.message);
          setOpenModal("");
          resetQuickForm("scheduled");
        } else {
          setWarning(scheduledResult.message);
        }

        setBusy(false);
        return;
      }

      const account = accounts.find((entry) => String(entry.id) === String(accountId));
      const depositId = uid();
      const createdAtIso = new Date().toISOString();

      const row = {
        id: depositId,
        user_id: userId,
        deposit_date: dt,
        source: src,
        amount: round2(amt),
        note: nt || "",
        account_id: accountId || null,
        account_name: account?.name || null,
        created_at: createdAtIso,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("income_deposits")
        .insert([row])
        .select()
        .single();

      if (error) throw error;

      if (accountId) {
        const routed = await addDepositLedger({
          userId,
          accountId,
          accountName: account?.name || "",
          amountValue: amt,
          sourceId: depositId,
          sourceLabel: src,
          noteText: nt,
          createdAt: createdAtIso,
        });

        if (!routed.ok) {
          await supabase.from("income_deposits").delete().eq("id", depositId).eq("user_id", userId);
          throw new Error(routed.message || "Income deposit ledger write failed.");
        }

        setAccounts((prev) =>
          prev.map((entry) =>
            String(entry.id) === String(accountId)
              ? { ...entry, balance: Number(entry.balance || 0) + Number(amt || 0) }
              : entry
          )
        );
      }

      const savedDeposit = mapDepositRowToClient(data);
      setDeposits((prev) => [savedDeposit, ...prev]);

      if (quickForm.createCalendarEvent || settings.autoCreateCalendar) {
        const cal = await upsertIncomeCalendarEvent({
          sourceId: depositId,
          sourceTable: "income_deposits",
          title: src || "Payday",
          payDate: dt,
          amountValue: amt,
          noteText: nt,
          statusValue: "done",
        });

        if (!cal.ok && cal.message) setWarning((prev) => prev || cal.message);
      }

      setStatus(`Income logged.${accountId ? ` Posted to ${account?.name || "account"}.` : ""}`);
      setOpenModal("");
      resetQuickForm("received");
    } catch (err) {
      setPageError(err?.message || "Failed to save income deposit.");
    } finally {
      setBusy(false);
    }
  }

  function openEditDeposit(deposit) {
    setEditForm(buildEditForm(deposit));
    setOpenModal("edit");
  }

  async function saveDepositEdit() {
    if (!userId || !supabase || !editForm.id || busy) return;

    const existing = deposits.find((entry) => entry.id === editForm.id);
    if (!existing) return;

    const dt = String(editForm.date || "").trim();
    const src = String(editForm.source || "").trim();
    const amt = parseMoneyInput(editForm.amount);
    const nt = String(editForm.note || "").trim();

    if (!dt || !src || !Number.isFinite(amt) || amt <= 0) {
      setPageError("Need valid date, source, and amount.");
      return;
    }

    setBusy(true);
    setPageError("");

    try {
      if (existing.accountId && Number(existing.amount) !== Number(amt)) {
        const delta = Number(amt) - Number(existing.amount || 0);

        if (delta !== 0) {
          const { addDepositLedger: _, ...rest } = {};
          try {
            const { writeAccountDelta } = await import("@/lib/accountLedger");
            await writeAccountDelta({
              userId,
              accountId: existing.accountId,
              delta,
              kind: "income_edit_adjustment",
              amount: Math.abs(delta),
              note: `${src}${nt ? ` • ${nt}` : ""} • edit adjustment`,
              sourceType: "income_deposit_edit",
              sourceId: existing.id,
              createdAt: new Date().toISOString(),
            });

            setAccounts((prev) =>
              prev.map((account) =>
                String(account.id) === String(existing.accountId)
                  ? { ...account, balance: Number(account.balance || 0) + delta }
                  : account
              )
            );
          } catch (err) {
            throw new Error(err?.message || "Failed to adjust linked account.");
          }
        }
      }

      const { data, error } = await supabase
        .from("income_deposits")
        .update({
          deposit_date: dt,
          source: src,
          amount: round2(amt),
          note: nt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editForm.id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      const saved = mapDepositRowToClient(data);
      setDeposits((prev) => prev.map((entry) => (entry.id === editForm.id ? saved : entry)));
      await updateIncomeCalendarEventIfExists({
        sourceId: editForm.id,
        title: src,
        payDate: dt,
        amountValue: amt,
        noteText: nt,
      });

      setStatus("Deposit updated.");
      setOpenModal("");
      setEditForm(buildEditForm(null));
    } catch (err) {
      setPageError(err?.message || "Failed to update deposit.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDeposit(id) {
    if (!userId || !supabase || busy) return;
    if (!globalThis.confirm?.("Delete this deposit?")) return;

    const existing = deposits.find((entry) => entry.id === id);
    if (!existing) return;

    setBusy(true);
    setPageError("");

    try {
      if (existing.accountId) {
        await reverseDepositLedger({ userId, deposit: existing });
        setAccounts((prev) =>
          prev.map((entry) =>
            String(entry.id) === String(existing.accountId)
              ? { ...entry, balance: Number(entry.balance || 0) - Number(existing.amount || 0) }
              : entry
          )
        );
      }

      const { error } = await supabase
        .from("income_deposits")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      await deleteCalendarEventBySource("income", id).catch(() => {});
      setDeposits((prev) => prev.filter((entry) => entry.id !== id));
      setStatus("Deposit deleted.");
    } catch (err) {
      setPageError(err?.message || "Failed to delete deposit.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteScheduled(id) {
    if (!userId || !supabase || busy) return;
    if (!globalThis.confirm?.("Delete this scheduled payday?")) return;

    const existing = scheduled.find((entry) => entry.id === id);
    setBusy(true);
    setPageError("");

    try {
      const { error } = await supabase
        .from("scheduled_paydays")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      if (existing?.calendar_event_id) {
        await supabase
          .from("calendar_events")
          .delete()
          .eq("id", existing.calendar_event_id)
          .eq("user_id", userId);
      } else {
        await deleteCalendarEventBySource("income", id).catch(() => {});
      }

      setScheduled((prev) => prev.filter((entry) => entry.id !== id));
      setStatus("Scheduled payday deleted.");
    } catch (err) {
      setPageError(err?.message || "Could not delete scheduled payday.");
    } finally {
      setBusy(false);
    }
  }

  async function markScheduledReceived(item) {
    if (!userId || !supabase || busy) return;

    setBusy(true);
    setPageError("");
    setWarning("");

    try {
      const depositId = uid();
      const createdAtIso = new Date().toISOString();

      const row = {
        id: depositId,
        user_id: userId,
        deposit_date: item.pay_date,
        source: item.source || "Paycheck",
        amount: round2(item.expected_amount),
        note: item.note || "",
        account_id: item.account_id || null,
        account_name: item.account_name || null,
        created_at: createdAtIso,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("income_deposits")
        .insert([row])
        .select()
        .single();

      if (error) throw error;

      if (item.account_id) {
        const routed = await addDepositLedger({
          userId,
          accountId: item.account_id,
          accountName: item.account_name || "",
          amountValue: item.expected_amount,
          sourceId: depositId,
          sourceLabel: item.source || "Paycheck",
          noteText: item.note || "",
          createdAt: createdAtIso,
        });

        if (!routed.ok) {
          await supabase.from("income_deposits").delete().eq("id", depositId).eq("user_id", userId);
          throw new Error(routed.message || "Failed to route payday to account.");
        }

        setAccounts((prev) =>
          prev.map((entry) =>
            String(entry.id) === String(item.account_id)
              ? { ...entry, balance: Number(entry.balance || 0) + Number(item.expected_amount || 0) }
              : entry
          )
        );
      }

      const updateScheduled = await supabase
        .from("scheduled_paydays")
        .update({ status: "received", updated_at: new Date().toISOString() })
        .eq("id", item.id)
        .eq("user_id", userId);

      if (updateScheduled.error) {
        setWarning("Deposit logged, but scheduled payday status did not update cleanly.");
      } else {
        setScheduled((prev) => prev.filter((entry) => entry.id !== item.id));
      }

      if (item.calendar_event_id) {
        await supabase
          .from("calendar_events")
          .update({ status: "done", updated_at: new Date().toISOString() })
          .eq("id", item.calendar_event_id)
          .eq("user_id", userId);
      } else {
        await upsertIncomeCalendarEvent({
          sourceId: item.id,
          sourceTable: "scheduled_paydays",
          title: item.source || "Payday",
          payDate: item.pay_date,
          amountValue: item.expected_amount,
          noteText: item.note || "",
          statusValue: "done",
        }).catch(() => {});
      }

      setDeposits((prev) => [mapDepositRowToClient(data), ...prev]);
      setStatus("Scheduled payday marked received.");
    } catch (err) {
      setPageError(err?.message || "Failed to convert payday into deposit.");
    } finally {
      setBusy(false);
    }
  }

  const toolsPanel = (
    <>
      <div className={styles.detailCardFill}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>Month snapshot</div>
            <div className={styles.panelSub}>Fast read on the current view month.</div>
          </div>
          <div className={styles.inlinePills}>
            <div className={styles.smallBadge}>{dateLabel(summary.nextScheduled?.pay_date) || "No scheduled"}</div>
          </div>
        </div>

        <div className={styles.infoList}>
          <div className={styles.infoRow}><span>Received</span><span>{money(summary.monthTotal)}</span></div>
          <div className={styles.infoRow}><span>Projected finish</span><span>{money(summary.projectedThisMonth)}</span></div>
          <div className={styles.infoRow}><span>Remaining</span><span>{money(summary.remaining)}</span></div>
          <div className={styles.infoRow}><span>Need per day</span><span>{money(summary.neededPerDay)}</span></div>
          <div className={styles.infoRow}><span>Last 7 days</span><span>{money(summary.last7Total)}</span></div>
        </div>
      </div>

      <div className={styles.detailCardFill}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>Income settings</div>
            <div className={styles.panelSub}>Defaults for pace, schedule, routing, and calendar.</div>
          </div>
        </div>

        <div className={styles.formGrid}>
          <label className={styles.fieldWrap}>
            <span>Monthly Target</span>
            <input
              className={styles.field}
              value={settingsDraft.goalMonthly}
              onChange={(e) => setDraftSetting("goalMonthly", e.target.value)}
              placeholder="8000"
            />
          </label>

          <label className={styles.fieldWrap}>
            <span>Pay Schedule</span>
            <select
              className={styles.field}
              value={settingsDraft.schedule}
              onChange={(e) => setDraftSetting("schedule", e.target.value)}
            >
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Biweekly</option>
              <option value="TWICE_MONTHLY">Twice monthly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </label>

          <label className={styles.fieldWrap}>
            <span>Anchor Payday</span>
            <input
              type="date"
              className={styles.field}
              value={settingsDraft.anchorDate}
              onChange={(e) => setDraftSetting("anchorDate", e.target.value)}
            />
          </label>

          <label className={styles.fieldWrap}>
            <span>Default Paycheck</span>
            <input
              className={styles.field}
              value={settingsDraft.paycheckAmt}
              onChange={(e) => setDraftSetting("paycheckAmt", e.target.value)}
              placeholder="2000"
            />
          </label>

          <label className={styles.fieldWrap}>
            <span>Bonus Estimate</span>
            <input
              className={styles.field}
              value={settingsDraft.bonusEstimate}
              onChange={(e) => setDraftSetting("bonusEstimate", e.target.value)}
              placeholder="0"
            />
          </label>

          <label className={styles.fieldWrap}>
            <span>Default Account</span>
            <select
              className={styles.field}
              value={settingsDraft.defaultAccountId}
              onChange={(e) => setDraftSetting("defaultAccountId", e.target.value)}
            >
              <option value="">No default</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldWrap}>
            <span>Calendar Profile</span>
            <select
              className={styles.field}
              value={settingsDraft.defaultProfileId}
              onChange={(e) => setDraftSetting("defaultProfileId", e.target.value)}
            >
              <option value="">No default</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldWrap}>
            <span>Payday Event Time</span>
            <input
              type="time"
              className={styles.field}
              value={settingsDraft.paydayEventTime}
              onChange={(e) => setDraftSetting("paydayEventTime", e.target.value)}
            />
          </label>
        </div>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={settingsDraft.autoCreateCalendar}
            onChange={(e) => setDraftSetting("autoCreateCalendar", e.target.checked)}
          />
          <span>Auto-create payday calendar events</span>
        </label>

        <div className={styles.detailActions}>
          <Button variant="primary" onClick={saveSettings} disabled={busy}>
            <Save size={14} />
            Save settings
          </Button>
        </div>
      </div>
    </>
  );

  if (loading) {
    return (
      <main className={styles.page}>
        <GlassPane className={styles.gatePanel}>
          <div className={styles.gateText}>Loading income command…</div>
        </GlassPane>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className={styles.page}>
        <GlassPane className={styles.gatePanel}>
          <div className={styles.gateText}>Sign in to use income.</div>
        </GlassPane>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Toast
        error={pageError}
        status={status}
        warning={warning}
        onClearError={() => setPageError("")}
      />

      <SummaryStrip summary={summary} selectedEntry={selectedEntry} settings={settings} />

      <div className={styles.mobileTabs}>
        {[
          { value: "list", label: "Income" },
          { value: "command", label: "Command" },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            className={`${styles.mobileTab} ${mobileSection === item.value ? styles.mobileTabActive : ""}`}
            onClick={() => setMobileSection(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.workspace}>
        <section
          className={`${styles.workspaceCol} ${styles.leftCol} ${mobileSection === "list" ? styles.workspaceColShow : ""}`}
        >
          <QueuePane
            entries={queueEntries}
            selectedEntry={selectedEntry}
            onSelect={(key) => {
              setSelectedEntryKey(key);
              setMobileSection("command");
            }}
            search={queueSearch}
            setSearch={setQueueSearch}
            filter={queueFilter}
            setFilter={setQueueFilter}
            viewMonth={settings.viewMonth}
          />
        </section>

        <section
          className={`${styles.workspaceCol} ${styles.mainCol} ${mobileSection === "command" ? styles.workspaceColShow : ""}`}
        >
          <FocusPane
            selectedEntry={selectedEntry}
            summary={summary}
            settings={settings}
            accounts={accounts}
            tab={tab}
            setTab={setTab}
            receivedItems={summary.monthDeposits}
            scheduledItems={summary.upcomingScheduled}
            sourceBreakdown={summary.sourceBreakdown}
            projectedOnly={summary.projectedOnly}
            onOpenNewReceived={() => {
              setQuickForm(buildQuickForm(settings, "received"));
              setOpenModal("new");
            }}
            onOpenNewScheduled={() => {
              setQuickForm(buildQuickForm(settings, "scheduled"));
              setOpenModal("new");
            }}
            onEditDeposit={openEditDeposit}
            onDeleteDeposit={deleteDeposit}
            onMarkScheduledReceived={markScheduledReceived}
            onDeleteScheduled={deleteScheduled}
            toolsPanel={toolsPanel}
          />
        </section>
      </div>

      <ModalShell
        open={openModal === "new"}
        title={quickForm.mode === "scheduled" ? "Schedule Payday" : "Log Income"}
        subcopy={
          quickForm.mode === "scheduled"
            ? "Create the next payday without cluttering the main workspace."
            : "Post received income and route it through the shared ledger."
        }
        onClose={() => setOpenModal("")}
        footer={
          <>
            <Button onClick={() => setOpenModal("")}>Cancel</Button>
            <Button variant="primary" onClick={submitQuickEntry} disabled={busy}>
              {busy ? "Saving…" : quickForm.mode === "scheduled" ? "Schedule payday" : "Log income"}
            </Button>
          </>
        }
      >
        <div className={styles.toggleRow}>
          <Button
            variant={quickForm.mode === "received" ? "primary" : "ghost"}
            onClick={() => setQuickForm((prev) => ({ ...buildQuickForm(settings, "received"), ...prev, mode: "received" }))}
          >
            Received
          </Button>
          <Button
            variant={quickForm.mode === "scheduled" ? "primary" : "ghost"}
            onClick={() => setQuickForm((prev) => ({ ...buildQuickForm(settings, "scheduled"), ...prev, mode: "scheduled" }))}
          >
            Scheduled
          </Button>
        </div>

        <div className={styles.formGrid}>
          <label className={styles.fieldWrap}>
            <span>Date</span>
            <input
              type="date"
              className={styles.field}
              value={quickForm.date}
              onChange={(e) => setQuickForm((prev) => ({ ...prev, date: e.target.value }))}
            />
          </label>

          <label className={styles.fieldWrap}>
            <span>Source</span>
            <input
              className={styles.field}
              value={quickForm.source}
              onChange={(e) => setQuickForm((prev) => ({ ...prev, source: e.target.value }))}
              placeholder="Paycheck"
            />
          </label>

          <label className={styles.fieldWrap}>
            <span>Amount</span>
            <input
              className={styles.field}
              value={quickForm.amount}
              onChange={(e) => setQuickForm((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder="2000"
              inputMode="decimal"
            />
          </label>

          <label className={styles.fieldWrap}>
            <span>Destination Account</span>
            <select
              className={styles.field}
              value={quickForm.destinationAccountId}
              onChange={(e) => setQuickForm((prev) => ({ ...prev, destinationAccountId: e.target.value }))}
            >
              <option value="">No account routing</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} • {money(account.balance)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={styles.fieldWrap}>
          <span>Note</span>
          <textarea
            className={styles.fieldArea}
            value={quickForm.note}
            onChange={(e) => setQuickForm((prev) => ({ ...prev, note: e.target.value }))}
            placeholder="Optional note…"
          />
        </label>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={quickForm.createCalendarEvent}
            onChange={(e) => setQuickForm((prev) => ({ ...prev, createCalendarEvent: e.target.checked }))}
          />
          <span>
            {quickForm.mode === "scheduled" ? "Create scheduled payday event" : "Create payday event"}
          </span>
        </label>
      </ModalShell>

      <ModalShell
        open={openModal === "edit"}
        title="Edit Deposit"
        subcopy="Update the deposit and keep the calendar mirror aligned."
        onClose={() => setOpenModal("")}
        footer={
          <>
            <Button onClick={() => setOpenModal("")}>Cancel</Button>
            <Button variant="primary" onClick={saveDepositEdit} disabled={busy}>
              {busy ? "Saving…" : "Save edit"}
            </Button>
          </>
        }
      >
        <div className={styles.formGrid}>
          <label className={styles.fieldWrap}>
            <span>Date</span>
            <input
              type="date"
              className={styles.field}
              value={editForm.date}
              onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
            />
          </label>

          <label className={styles.fieldWrap}>
            <span>Source</span>
            <input
              className={styles.field}
              value={editForm.source}
              onChange={(e) => setEditForm((prev) => ({ ...prev, source: e.target.value }))}
            />
          </label>

          <label className={styles.fieldWrap}>
            <span>Amount</span>
            <input
              className={styles.field}
              value={editForm.amount}
              onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))}
              inputMode="decimal"
            />
          </label>
        </div>

        <label className={styles.fieldWrap}>
          <span>Note</span>
          <textarea
            className={styles.fieldArea}
            value={editForm.note}
            onChange={(e) => setEditForm((prev) => ({ ...prev, note: e.target.value }))}
          />
        </label>
      </ModalShell>
    </main>
  );
}
