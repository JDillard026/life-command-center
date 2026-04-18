"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import GlassPane from "../components/GlassPane";
import { supabase } from "@/lib/supabaseClient";
import styles from "./DashboardPage.module.css";
import {
  addMonthsClamped,
  buildDashboardState,
  endOfMonthISO,
  fetchQuoteMap,
  mapAccountRowToClient,
  mapBillRowToClient,
  mapIncomeDepositRowToClient,
  mapInvestmentAssetRow,
  mapInvestmentTxnRow,
  mapSavingsGoalRow,
  mapSpendingTxRowToClient,
  startOfMonthISO,
  startOfToday,
} from "./dashboard.helpers";
import {
  DashboardKpiStrip,
  DashboardTopbar,
  DesktopDashboard,
  MobileDashboard,
} from "./dashboard.components";

export default function DashboardCommand() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileZone, setMobileZone] = useState("overview");

  const [accounts, setAccounts] = useState([]);
  const [bills, setBills] = useState([]);
  const [spendingTx, setSpendingTx] = useState([]);
  const [incomeDeposits, setIncomeDeposits] = useState([]);
  const [investmentAssets, setInvestmentAssets] = useState([]);
  const [investmentTxns, setInvestmentTxns] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [quoteMap, setQuoteMap] = useState({});

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const media = window.matchMedia("(max-width: 860px)");
    const sync = () => setIsMobileViewport(media.matches);

    sync();

    if (media.addEventListener) {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }

    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setLoading(true);
      setPageError("");

      try {
        if (!supabase) {
          throw new Error("Missing Supabase environment variables.");
        }

        const {
          data: { user: currentUser },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;

        if (!currentUser) {
          if (!mounted) return;
          setUser(null);
          setLoading(false);
          return;
        }

        if (!mounted) return;
        setUser(currentUser);

        const today = startOfToday();
        const prevMonthStart = startOfMonthISO(addMonthsClamped(today, -1));
        const monthEnd = endOfMonthISO(today);

        const [
          accRes,
          billsRes,
          spendingRes,
          incomeRes,
          assetRes,
          txnRes,
          goalsRes,
        ] = await Promise.all([
          supabase.from("accounts").select("*").eq("user_id", currentUser.id),
          supabase.from("bills").select("*").eq("user_id", currentUser.id),
          supabase
            .from("spending_transactions")
            .select("*")
            .eq("user_id", currentUser.id)
            .gte("tx_date", prevMonthStart)
            .lte("tx_date", monthEnd),
          supabase
            .from("income_deposits")
            .select("*")
            .eq("user_id", currentUser.id)
            .gte("deposit_date", prevMonthStart)
            .lte("deposit_date", monthEnd),
          supabase.from("investment_assets").select("*").eq("user_id", currentUser.id),
          supabase.from("investment_transactions").select("*").eq("user_id", currentUser.id),
          supabase.from("savings_goals").select("*").eq("user_id", currentUser.id),
        ]);

        if (accRes.error) throw accRes.error;
        if (billsRes.error) throw billsRes.error;
        if (spendingRes.error) throw spendingRes.error;
        if (incomeRes.error) throw incomeRes.error;
        if (assetRes.error) throw assetRes.error;
        if (txnRes.error) throw txnRes.error;
        if (goalsRes.error) throw goalsRes.error;

        const loadedAssets = (assetRes.data || []).map(mapInvestmentAssetRow);
        const nextQuotes = await fetchQuoteMap(
          loadedAssets.map((asset) => asset.symbol).filter(Boolean)
        );

        if (!mounted) return;

        setAccounts((accRes.data || []).map(mapAccountRowToClient));
        setBills((billsRes.data || []).map(mapBillRowToClient));
        setSpendingTx((spendingRes.data || []).map(mapSpendingTxRowToClient));
        setIncomeDeposits((incomeRes.data || []).map(mapIncomeDepositRowToClient));
        setInvestmentAssets(loadedAssets);
        setInvestmentTxns((txnRes.data || []).map(mapInvestmentTxnRow));
        setSavingsGoals((goalsRes.data || []).map(mapSavingsGoalRow));
        setQuoteMap(nextQuotes);
      } catch (err) {
        if (!mounted) return;
        setPageError(err?.message || "Failed to load dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const computed = useMemo(
    () =>
      buildDashboardState({
        accounts,
        bills,
        spendingTx,
        incomeDeposits,
        investmentAssets,
        investmentTxns,
        savingsGoals,
        quoteMap,
        search,
      }),
    [
      accounts,
      bills,
      spendingTx,
      incomeDeposits,
      investmentAssets,
      investmentTxns,
      savingsGoals,
      quoteMap,
      search,
    ]
  );

  if (loading) {
    return (
      <main className={styles.page}>
        <GlassPane size="hero" className={styles.shell}>
          <div className={styles.loading}>Loading dashboard.</div>
        </GlassPane>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={styles.page}>
        <GlassPane size="hero" className={styles.shell}>
          <div className={styles.loading}>Please log in.</div>
          <div className={styles.loginSub}>This dashboard requires an authenticated user.</div>
          <div className={styles.loginActionRow}>
            <Link href="/login" className={styles.loginAction}>
              Go to login
            </Link>
          </div>
        </GlassPane>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <GlassPane size="hero" className={styles.shell}>
        {pageError ? (
          <div className={styles.errorBox}>
            <div className={styles.errorTitle}>Dashboard error</div>
            <div className={styles.errorText}>{pageError}</div>
          </div>
        ) : null}

        <DashboardTopbar search={search} setSearch={setSearch} computed={computed} />
        <DashboardKpiStrip computed={computed} />

        {isMobileViewport ? (
          <MobileDashboard
            computed={computed}
            mobileZone={mobileZone}
            setMobileZone={setMobileZone}
          />
        ) : (
          <DesktopDashboard computed={computed} />
        )}
      </GlassPane>
    </main>
  );
}
