function safeNum(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function round2(value) {
  return Math.round((safeNum(value, 0) + Number.EPSILON) * 100) / 100;
}

export function monthlyRate(annualRatePct) {
  return safeNum(annualRatePct, 0) / 100 / 12;
}

export function monthlyPayment(principal, annualRatePct, months) {
  const balance = safeNum(principal, 0);
  const n = Math.max(1, Math.round(safeNum(months, 0)));
  const r = monthlyRate(annualRatePct);

  if (balance <= 0) return 0;
  if (r === 0) return balance / n;

  return (balance * r) / (1 - Math.pow(1 + r, -n));
}

export function solveRemainingMonths(balance, annualRatePct, payment) {
  const principal = safeNum(balance, 0);
  const pay = safeNum(payment, 0);
  const r = monthlyRate(annualRatePct);

  if (principal <= 0 || pay <= 0) return 0;
  if (r === 0) return Math.ceil(principal / pay);
  if (pay <= principal * r) return 360;

  const months = -Math.log(1 - (principal * r) / pay) / Math.log(1 + r);
  if (!Number.isFinite(months) || months <= 0) return 360;
  return Math.max(1, Math.ceil(months));
}

export function amortizeForMonths(balance, annualRatePct, payment, months) {
  let remaining = safeNum(balance, 0);
  const pay = Math.max(0, safeNum(payment, 0));
  const r = monthlyRate(annualRatePct);
  const n = Math.max(0, Math.round(safeNum(months, 0)));
  let totalInterest = 0;
  let totalPrincipal = 0;

  for (let i = 0; i < n; i += 1) {
    if (remaining <= 0.000001) break;

    const interest = r === 0 ? 0 : remaining * r;
    const principalPaid = Math.min(Math.max(pay - interest, 0), remaining);
    const actualPayment = principalPaid + interest;

    totalInterest += interest;
    totalPrincipal += principalPaid;
    remaining = Math.max(remaining - principalPaid, 0);

    if (actualPayment <= 0.000001) break;
  }

  return {
    remainingBalance: round2(remaining),
    interestPaid: round2(totalInterest),
    principalPaid: round2(totalPrincipal),
  };
}

function formatCurrency(value) {
  const num = safeNum(value, 0);
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPct(value) {
  const num = safeNum(value, 0);
  return `${num.toFixed(2)}%`;
}

function yearsBetween(dateString, fallbackYears = 0.8) {
  if (!dateString) return fallbackYears;
  const start = new Date(dateString);
  if (Number.isNaN(start.getTime())) return fallbackYears;

  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  return years > 0 ? years : fallbackYears;
}

export function calculateRefinanceAnalysis(input) {
  const currentBalance = Math.max(0, safeNum(input.currentBalance, 0));
  const currentRate = Math.max(0, safeNum(input.currentRate, 0));
  const currentPayment = Math.max(0, safeNum(input.currentPayment, 0));
  const newRate = Math.max(0, safeNum(input.newRate, 0));
  const newTermYears = Math.max(1, safeNum(input.newTermYears, 30));
  const closingCosts = Math.max(0, safeNum(input.closingCosts, 0));
  const yearsStaying = Math.max(0, safeNum(input.yearsStaying, 5));

  const remainingMonths = solveRemainingMonths(
    currentBalance,
    currentRate,
    currentPayment
  );
  const newTermMonths = Math.max(1, Math.round(newTermYears * 12));
  const newPaymentRaw = monthlyPayment(currentBalance, newRate, newTermMonths);
  const newPayment = round2(newPaymentRaw);
  const monthlySavings = round2(currentPayment - newPayment);
  const breakEvenMonths = monthlySavings > 0 ? Math.ceil(closingCosts / monthlySavings) : null;
  const stayMonths = Math.max(1, Math.round(yearsStaying * 12));

  const currentStay = amortizeForMonths(
    currentBalance,
    currentRate,
    currentPayment,
    Math.min(stayMonths, remainingMonths)
  );
  const newStay = amortizeForMonths(
    currentBalance,
    newRate,
    newPayment,
    Math.min(stayMonths, newTermMonths)
  );

  const currentInterestRemaining = round2(currentPayment * remainingMonths - currentBalance);
  const newInterestRemaining = round2(newPayment * newTermMonths - currentBalance + closingCosts);
  const lifetimeInterestDelta = round2(currentInterestRemaining - newInterestRemaining);
  const stayHorizonCashDelta = round2(
    currentPayment * Math.min(stayMonths, remainingMonths) -
      (newPayment * Math.min(stayMonths, newTermMonths) + closingCosts)
  );

  const yearsElapsed = yearsBetween(input.loanStartDate);
  const resetRisk =
    newTermMonths > remainingMonths
      ? round2((newTermMonths - remainingMonths) / 12)
      : 0;

  let verdict = "Hold";
  let headline = "Not worth refinancing yet";
  let reason = "The savings are too thin for the reset and closing costs.";

  if (newRate >= currentRate) {
    verdict = "No";
    headline = "Do not refinance at this rate";
    reason = `Your new rate of ${formatPct(newRate)} is not better than the current ${formatPct(currentRate)}.`;
  } else if (monthlySavings <= 0) {
    verdict = "No";
    headline = "This refi does not lower the payment";
    reason = "It fails the first screen. No monthly savings means no reason to do it.";
  } else if (!breakEvenMonths || breakEvenMonths > stayMonths) {
    verdict = "Wait";
    headline = "Only makes sense if you stay longer";
    reason = `You would need about ${breakEvenMonths || "more"} months to recover ${formatCurrency(closingCosts)}.`;
  } else if (stayHorizonCashDelta <= 0) {
    verdict = "Weak";
    headline = "Technically cheaper, but weak overall";
    reason = "The payment drops, but the stay-horizon payoff is not strong enough yet.";
  } else if (resetRisk >= 7 && yearsElapsed < 3) {
    verdict = "Caution";
    headline = "Savings look real, but you are resetting hard";
    reason = "This lowers the payment, but you are stretching the debt back out in a big way.";
  } else {
    verdict = "Yes";
    headline = "This refinance looks worth it";
    reason = `The payment drop is meaningful and you clear break-even inside your stay window.`;
  }

  const bullets = [
    `Current estimated payoff remaining: ${remainingMonths} months.`,
    `New payment would be about ${formatCurrency(newPayment)} on a ${newTermYears}-year reset.`,
    breakEvenMonths
      ? `Break-even lands around month ${breakEvenMonths}.`
      : "There is no break-even because the payment does not improve.",
    resetRisk > 0
      ? `You are adding roughly ${resetRisk.toFixed(1)} years back to the debt clock.`
      : "You are not extending the debt clock materially.",
  ];

  return {
    currentBalance: round2(currentBalance),
    currentRate: round2(currentRate),
    currentPayment: round2(currentPayment),
    remainingMonths,
    newRate: round2(newRate),
    newTermYears: round2(newTermYears),
    newTermMonths,
    newPayment,
    closingCosts: round2(closingCosts),
    yearsStaying: round2(yearsStaying),
    stayMonths,
    monthlySavings,
    breakEvenMonths,
    currentInterestRemaining,
    newInterestRemaining,
    lifetimeInterestDelta,
    stayHorizonCashDelta,
    stayCurrentInterest: currentStay.interestPaid,
    stayNewInterest: newStay.interestPaid + closingCosts,
    stayCurrentBalance: currentStay.remainingBalance,
    stayNewBalance: newStay.remainingBalance,
    resetRiskYears: resetRisk,
    verdict,
    headline,
    reason,
    bullets,
  };
}
