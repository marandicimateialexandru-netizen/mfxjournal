import {
  Sparkles,
  Gauge,
  LineChart,
  PieChart,
  CalendarDays,
  CalendarRange,
  Plus,
  Receipt,
  SlidersHorizontal,
  NotebookPen,
  Images,
  BookOpen,
  Tags,
  Target,
  Dices,
  Wand2,
  Bot,
  PartyPopper,
  ListPlus,
  type LucideIcon,
} from "lucide-react";
import { useUiStore } from "@/store/uiStore";

export interface TourStep {
  id: string;
  /** Route this step needs to be on — `undefined` for steps that don't highlight anything on a
   *  specific page (the welcome/done bookends). The tour navigates here automatically on entering
   *  the step. */
  route?: string;
  /** CSS selector for the element to spotlight — matched against `data-tour="..."` attributes
   *  scattered across the app's pages/sidebar/modals. `undefined` centers the card with no spotlight. */
  selector?: string;
  /** Fired the instant this step becomes active, before anything else — used to defensively reset
   *  state a PREVIOUS step's `preClickSelector` may have left open (closing a modal), regardless of
   *  which direction the tour arrived from. */
  onEnter?: () => void;
  /** Optional selector for something to actually CLICK before searching for `selector` — this is how
   *  the tour performs real interactions (opening the trade form, picking a calendar day) instead of
   *  just describing them. If multiple elements match, the first one that isn't `disabled` is used
   *  (e.g. picking any calendar day that actually has trades on it). */
  preClickSelector?: string;
  /** Forces the card to dock beside the target (right, else left) instead of the automatic
   *  below/above/centered choice — for a target wide/tall enough that the card genuinely has no
   *  clear room in either of those directions (a page-width Dialog, most often), where the automatic
   *  centered fallback would otherwise land the card directly on top of the target's own main content.
   *  Confirmed necessary by direct visual testing, not a guess — see `TourOverlay.tsx`'s
   *  `computeCardPosition`. */
  cardSide?: "left" | "right";
  icon: LucideIcon;
  title: string;
  body: string;
  /** A short, concrete example shown in its own callout beneath the body — every step gets one, since
   *  an abstract description of a feature is a lot less useful than "here's what that actually looks
   *  like filled in." */
  example: string;
}

const closeTradeModal = () => useUiStore.getState().closeAddTradeModal();
const closeWeekModal = () => document.querySelector<HTMLButtonElement>('[data-tour="week-modal-close"]')?.click();

/** The full guided onboarding tour — auto-launched once per profile on their first login (see
 *  `App.tsx`), replayable anytime from Settings. Genuinely INTERACTIVE, not just a slideshow of
 *  spotlights: several steps use `preClickSelector` to actually open the trade form or pick a real
 *  calendar day/week, the same way the trader would, then spotlight the result — "here's the button"
 *  followed by "and here's what it does," not left as an exercise for later. `onEnter` on the two
 *  steps bracketing the trade-form cluster (`new-trade`, `journal`) defensively closes anything a
 *  `preClickSelector` opened, regardless of which direction the tour is moving — simpler and more
 *  robust than trying to track "did we just come from inside the modal." */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    icon: Sparkles,
    title: "Welcome to MFX Journal",
    body: "A real walkthrough — not just labels. We'll click through the dashboard, log a real trade, open a real day and week, and try the AI advisor. About two minutes. Skip anytime, replay anytime from Settings.",
    example: "Think of this as a co-pilot run of your first session, not a manual.",
  },
  {
    id: "stats",
    route: "/dashboard",
    selector: '[data-tour="dashboard-stats"]',
    icon: Gauge,
    title: "Your numbers at a glance",
    body: "Total R is profit/loss in multiples of your risk, not raw currency — it's what lets a $50 account and a $50,000 account compare fairly. BE Rate is trades that broke even; they're excluded from your win rate, not counted against it.",
    example: "Risked $100 and made $250? That's +2.5R, regardless of account size.",
  },
  {
    id: "equity",
    route: "/dashboard",
    selector: '[data-tour="dashboard-equity"]',
    icon: LineChart,
    title: "Equity Curve & App Score",
    body: "The Equity Curve plots your cumulative R trade-by-trade — a smooth line up-and-right is what consistency looks like. App Score grades your overall discipline (consistency, drawdown control, risk sizing), not just whether you're profitable.",
    example: "You can be net positive with a low App Score if your wins are luck-sized and your losses are panic-sized.",
  },
  {
    id: "charts",
    route: "/dashboard",
    selector: '[data-tour="dashboard-charts"]',
    icon: PieChart,
    title: "Outcome & performance breakdowns",
    body: "Three angles on the same trades: your win/loss/breakeven split, your daily P&L bars, and your result by calendar month — each one surfaces a different kind of pattern.",
    example: "A flat monthly chart with a spiky daily one usually means you're giving back winning days.",
  },
  {
    id: "calendar-day",
    route: "/dashboard",
    preClickSelector: '[data-tour="calendar-day"]',
    selector: '[data-tour="calendar-day-panel"]',
    cardSide: "left",
    icon: CalendarDays,
    title: "Click a day, see everything",
    body: "We just clicked a real day for you. Every trading day is color-coded by result, and clicking one lists every trade from that day on the right — click any of THOSE for the full trade detail, screenshots included.",
    example: "A red day with 4 trades often means revenge trading — the day view is where you'd catch that.",
  },
  {
    id: "calendar-week",
    route: "/dashboard",
    preClickSelector: '[data-tour="calendar-week"]',
    selector: '[data-tour="week-modal"]',
    cardSide: "right",
    icon: CalendarRange,
    title: "Zoom out to a full week",
    body: "The \"Week\" column does the same thing at a wider angle — every trade across all five days in one sortable, exportable table, with the week's total, win count, and loss count up top.",
    example: "Good for a Sunday review: was this a good WEEK, even if Tuesday was rough?",
  },
  {
    id: "new-trade",
    route: "/dashboard",
    onEnter: closeWeekModal,
    selector: '[data-tour="new-trade"]',
    icon: Plus,
    title: "Log a trade in seconds",
    body: "Always one click away, from any page — the button lives in the sidebar, not buried in a menu. Let's actually open it.",
    example: "Click Next and we'll open the real form.",
  },
  {
    id: "trade-details",
    route: "/dashboard",
    preClickSelector: '[data-tour="new-trade"] button',
    selector: '[data-tour="trade-details"]',
    icon: Receipt,
    title: "Trade Details",
    body: "Outcome (win/loss/breakeven), entry time, market, risk, and result — the minimum to log a trade. Risk and Result are both in R, so the math for every stat on the dashboard comes straight from here.",
    example: "Risked 1R, made 2.4R on a EURUSD long → Outcome: Win, Risk: 1, Result: 2.4.",
  },
  {
    id: "trade-variables",
    route: "/dashboard",
    selector: '[data-tour="trade-variables"]',
    cardSide: "right",
    icon: SlidersHorizontal,
    title: "Tag it against your Variables",
    body: "Whatever custom variables you've set up (see the Variables step coming up) show as fields right here, so tagging happens at the moment you log the trade, not as separate homework later.",
    example: "Tag this trade's Setup as \"OTE\" and Session as \"London\" — the Variables page will then show your win rate for OTE setups specifically.",
  },
  {
    id: "trade-notes",
    route: "/dashboard",
    selector: '[data-tour="trade-notes"]',
    icon: NotebookPen,
    title: "Notes",
    body: "Free text for whatever the numbers can't capture — your read on the setup, how you felt, what you'd do differently. This is what you'll actually re-read in a month.",
    example: "\"Entered before confirmation, got lucky it worked. Don't repeat.\"",
  },
  {
    id: "trade-screenshots",
    route: "/dashboard",
    selector: '[data-tour="trade-screenshots"]',
    cardSide: "right",
    icon: Images,
    title: "Screenshots",
    body: "Two slots — Entry and Liquidity — so the chart context for a trade lives with the trade itself. Click one to upload, click an uploaded one to zoom in full-screen, hover to replace or remove it.",
    example: "Screenshot your entry the moment you take it — reading your own reasoning weeks later is worth far more than the number alone.",
  },
  {
    id: "journal",
    onEnter: closeTradeModal,
    route: "/journal",
    selector: '[data-tour="journal-table"]',
    cardSide: "right",
    icon: BookOpen,
    title: "Journal",
    body: "Every trade you've ever logged, sortable by any column and searchable by symbol or notes. This is your full, unfiltered history — the dashboard summarizes it, this IS it.",
    example: "Sort by Result to instantly find your 10 worst trades and look for what they have in common.",
  },
  {
    id: "variables",
    route: "/variables",
    selector: '[data-tour="variables-grid"]',
    icon: Tags,
    title: "Variables — your own categories",
    body: "A Variable is any custom tag you want to track — what you can add is genuinely open-ended, and why you'd add one is always the same: to find out if it actually correlates with winning or losing.",
    example: "Add \"Setup\" (Breakout, Pullback, Reversal), \"Mistake\" (FOMO, Moved Stop, Oversized), or \"Emotion\" (Confident, Anxious, Bored) — each becomes its own win-rate breakdown automatically.",
  },
  {
    id: "variables-add-button",
    route: "/variables",
    selector: '[data-tour="new-variable-button"]',
    icon: Plus,
    title: "Adding one is one click",
    body: "Every card on this page — Setup, Emotion, whatever you build — starts here. Let's actually open it.",
    example: "Click Next and we'll open the real form.",
  },
  {
    id: "variables-add-form",
    route: "/variables",
    preClickSelector: '[data-tour="new-variable-button"]',
    selector: '[data-tour="new-variable-dialog"]',
    cardSide: "right",
    icon: ListPlus,
    title: "Text or Number",
    body: "Text variables (Setup, Emotion, Session) give you a dropdown of options you define, like \"Breakout\" or \"FOMO.\" Number variables (Risk %, Account Size) take a raw number per trade instead — no preset list.",
    example: "Name it, pick Text or Number, and for Text give it a first value — you can add more anytime from the card itself.",
  },
  {
    id: "advisor-metrics",
    route: "/advisor",
    selector: '[data-tour="advisor-metrics"]',
    icon: Target,
    title: "AI Advisor: advanced metrics",
    body: "Expectancy (expected R per trade, long-run), Max Drawdown, Profit Factor, your best/worst streaks, and Ruin Risk — the odds of a 10R+ drawdown based on how you actually trade, not a textbook formula.",
    example: "A positive Expectancy of +0.3R means every trade is worth +0.3R on average — that's the number that actually compounds.",
  },
  {
    id: "advisor-equity",
    route: "/advisor",
    selector: '[data-tour="advisor-equity"]',
    icon: LineChart,
    title: "Equity Curve & Drawdown",
    body: "The same equity idea as the dashboard, but with underwater drawdown depth shaded beneath it — so you can see not just that you recovered, but how far underwater you actually went first.",
    example: "A curve that's up overall but has a deep shaded dip in the middle shows a drawdown the summary number alone would hide.",
  },
  {
    id: "advisor-montecarlo",
    route: "/advisor",
    selector: '[data-tour="advisor-montecarlo"]',
    icon: Dices,
    title: "Monte Carlo Simulation",
    body: "Your real trades, reshuffled into thousands of different possible orderings — because the sequence you got was just ONE of many you could have gotten with the same edge. This shows the realistic range of outcomes, including bad luck.",
    example: "\"Worst 5%\" drawdown tells you: even trading exactly as well as you have been, how bad could a rough stretch still get?",
  },
  {
    id: "advisor-patterns",
    route: "/advisor",
    selector: '[data-tour="advisor-patterns"]',
    icon: Wand2,
    title: "Detected Patterns",
    body: "The AI scans your trades and variables for statistically real patterns — good and bad — and hands you a concrete next move for each, not just an observation.",
    example: "\"Your win rate drops 22% on trades tagged FOMO\" comes with a suggested rule to test, not just the stat.",
  },
  {
    id: "advisor-assistant",
    route: "/advisor",
    selector: '[data-tour="advisor-assistant"]',
    cardSide: "left",
    icon: Bot,
    title: "Ask the AI Assistant directly",
    body: "This isn't generic trading advice — it can query YOUR actual trade data and answer with YOUR real numbers.",
    example: "Try asking: \"What's my win rate on Fridays?\" or \"Show me my three biggest losing trades and what they had in common.\"",
  },
  {
    id: "done",
    icon: PartyPopper,
    title: "That's the full tour",
    body: "You've seen the dashboard, logged a trade, opened a day and a week, tagged a variable, and asked the AI a question — that's the whole loop. Replay anytime from Settings.",
    example: "Now go log a real one.",
  },
];
