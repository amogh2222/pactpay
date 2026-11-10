"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
} from "ag-grid-community";
import { AgCharts } from "ag-charts-react";
import {
  AllCommunityModule as ChartsModule,
  ModuleRegistry as ChartsRegistry,
  type AgChartOptions,
} from "ag-charts-community";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  Layers3,
  LoaderCircle,
  Play,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  X,
  Zap,
} from "lucide-react";
import type { ProcurementOrder } from "@/lib/store/procurement-store";
import type { Credentials, TelemetryLog } from "@/lib/paypal/client";
ModuleRegistry.registerModules([AllCommunityModule]);
ChartsRegistry.registerModules([ChartsModule]);
const gridTheme = themeQuartz.withParams({
  backgroundColor: "#FFFFFF",
  headerBackgroundColor: "#F8FAFC",
  borderColor: "#E2E8F0",
  rowHoverColor: "#F0F7FF",
  selectedRowBackgroundColor: "#EFF6FF",
  headerTextColor: "#475569",
  cellTextColor: "#0F172A",
  rowHeight: 58,
  headerHeight: 42,
  fontFamily: "var(--font-jakarta), sans-serif",
  fontSize: 12,
  borderRadius: 0,
  wrapperBorder: false,
});
const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const stageNames = [
  "Quote & invoice",
  "Approve & capture",
  "Track shipment",
  "Recover SLA rebate",
];
const steps = [
  "STEP_1_SOURCE_INVOICE",
  "STEP_2_CAPTURE_ORDER",
  "STEP_3_ATTACH_TRACKING",
  "STEP_4_SLA_REFUND",
];
type Sheet =
  | "invoice"
  | "quotes"
  | "telemetry"
  | "credentials"
  | "tracking"
  | "exception"
  | null;
const presets = [
  "35 mesh chairs under $410/unit",
  "24 enterprise docks under $250/unit",
  "10 standing desks under $510/unit",
];
export default function PactPayDashboard() {
  const [orders, setOrders] = useState<ProcurementOrder[]>([]),
    [logs, setLogs] = useState<TelemetryLog[]>([]),
    [selectedId, setSelectedId] = useState("PO-2026-4091"),
    [sheet, setSheet] = useState<Sheet>(null),
    [view, setView] = useState("ledger"),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [prompt, setPrompt] = useState(
      "Procure 35 ergonomic mesh chairs under $410/unit for Workspace Ops",
    ),
    [budget, setBudget] = useState(15000),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [credentials, setCredentials] = useState<Credentials | undefined>(),
    [clientId, setClientId] = useState(""),
    [clientSecret, setClientSecret] = useState(""),
    [connection, setConnection] = useState<{
      connected: boolean;
      latencyMs: number;
      mode: string;
    } | null>(null),
    [tracking, setTracking] = useState(""),
    [carrier, setCarrier] = useState("FEDEX"),
    [exception, setException] = useState(""),
    [demoStep, setDemoStep] = useState(-1);
  const api = useRef<GridApi<ProcurementOrder> | null>(null),
    busyRef = useRef(false),
    requestKey = useRef<string | null>(null);
  const selected = orders.find((o) => o.id === selectedId) || orders[0];
  async function refresh() {
    const res = await fetch("/api/orders");
    if (!res.ok) throw new Error("Unable to load procurement workspace");
    const data = await res.json();
    setOrders(data.orders);
    setLogs(data.telemetryLogs);
  }
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/orders");
        if (!res.ok) throw new Error("Unable to load procurement workspace");
        const data = await res.json();
        if (!ignore) {
          setOrders(data.orders);
          setLogs(data.telemetryLogs);
        }
      } catch (e: unknown) {
        if (!ignore) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  async function post(path: string, body: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  async function perform(fn: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
      await refresh().catch(() => {});
    } finally {
      busyRef.current = false;
      setBusy(false);
      setDemoStep(-1);
    }
  }
  async function source() {
    requestKey.current ||= crypto.randomUUID();
    const data = await post("/api/agent/procure", {
      prompt,
      budgetGuardrailUsd: budget,
      credentials,
      requestId: requestKey.current,
    });
    requestKey.current = null;
    setSelectedId(data.order.id);
    await refresh();
    setToast("Three vendors compared. PayPal milestone invoice issued.");
    return data.order as ProcurementOrder;
  }
  async function advance(
    order: ProcurementOrder,
    extra: Record<string, unknown> = {},
  ) {
    const step = Number(order.stage[0]);
    const data = await post("/api/paypal/workflow", {
      step: steps[Math.min(step, 3)],
      orderId: order.id,
      credentials,
      ...extra,
    });
    await refresh();
    setSelectedId(order.id);
    if (data.order.approveUrl) {
      setSheet("invoice");
      setToast(
        "Buyer approval required. Open PayPal, approve, then return to capture.",
      );
    } else setToast(`${stageNames[Math.min(step, 3)]} complete · ${order.id}`);
    return data.order as ProcurementOrder;
  }
  function next(order: ProcurementOrder, approve = false) {
    setSelectedId(order.id);
    if (order.stage === "4_SLA_SETTLED") {
      setSheet("quotes");
      return;
    }
    if (order.mode === "LIVE_SANDBOX" && order.stage === "2_ESCROW_CAPTURED") {
      setSheet("tracking");
      return;
    }
    if (order.mode === "LIVE_SANDBOX" && order.stage === "3_IN_TRANSIT") {
      setSheet("exception");
      return;
    }
    void perform(async () => {
      await advance(order, { approveGuardrail: approve });
    });
  }
  async function autopilot() {
    await perform(async () => {
      setDemoStep(0);
      let order = await source();
      for (let i = 1; i < 4; i++) {
        await new Promise((r) => setTimeout(r, 1800));
        setDemoStep(i);
        if (order.guardrailStatus === "AWAITING_CFO_APPROVAL") {
          setToast(
            "Autopilot paused: approve the spend guardrail to continue.",
          );
          return;
        }
        if (order.mode === "LIVE_SANDBOX" && i > 1) {
          setToast("Live workflow paused for shipment details.");
          return;
        }
        order = await advance(order);
        if (order.approveUrl) return;
      }
      setToast(
        "Lifecycle complete. SLA refund recovered and evidence packet prepared.",
      );
    });
  }
  function applyFilter(value: string) {
    const text = value.trim().toLowerCase();
    setQuery(value);
    setFilter(value);
    if (!api.current) return;
    api.current.applyColumnState({ defaultState: { sort: null } });
    api.current.setFilterModel(null);
    api.current.setGridOption("quickFilterText", "");
    if (/refund|sla settled/.test(text))
      api.current.setFilterModel({
        stage: { filterType: "text", type: "equals", filter: "4_SLA_SETTLED" },
      });
    else if (/approval|awaiting/.test(text))
      api.current.setFilterModel({
        guardrailStatus: {
          filterType: "text",
          type: "equals",
          filter: "AWAITING_CFO_APPROVAL",
        },
      });
    else if (/transit|shipment/.test(text))
      api.current.setFilterModel({
        stage: { filterType: "text", type: "equals", filter: "3_IN_TRANSIT" },
      });
    else if (/over|above|greater/.test(text)) {
      const amount = Number(
        text.replace(/,/g, "").match(/[\d]+(?:\.\d+)?/)?.[0],
      );
      if (amount)
        api.current.setFilterModel({
          totalGrossUsd: {
            filterType: "number",
            type: "greaterThan",
            filter: amount,
          },
        });
    } else if (/sort|highest|largest/.test(text)) {
      api.current.applyColumnState({
        state: [{ colId: "totalGrossUsd", sort: "desc" }],
        defaultState: { sort: null },
      });
    } else api.current.setGridOption("quickFilterText", value);
  }
  const columns: ColDef<ProcurementOrder>[] = [
    {
      headerName: "PO & department",
      field: "id",
      pinned: "left",
      width: 170,
      cellRenderer: ({ data: o }: { data: ProcurementOrder }) => (
        <div className="cell">
          <button
            className="mono link ink"
            onClick={() => {
              setSelectedId(o.id);
              setSheet("quotes");
            }}
          >
            {o.id}
          </button>
          <span className="subtext">{o.requesterDept}</span>
        </div>
      ),
    },
    {
      headerName: "Sourced item & winning vendor",
      field: "selectedQuote.title",
      width: 310,
      cellRenderer: ({ data: o }: { data: ProcurementOrder }) => (
        <div className="product-cell">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={o.selectedQuote.imageUrl}
            alt=""
            onError={(e) => {
              e.currentTarget.src = "/products/chair.svg";
            }}
          />
          <div className="cell">
            <b>{o.selectedQuote.title}</b>
            <span className="subtext">
              {o.selectedQuote.supplierName}{" "}
              <button
                className="link"
                onClick={() => {
                  setSelectedId(o.id);
                  setSheet("quotes");
                }}
              >
                Compare 3 ↗
              </button>
            </span>
          </div>
        </div>
      ),
    },
    {
      headerName: "Gross escrow",
      field: "totalGrossUsd",
      filter: "agNumberColumnFilter",
      width: 156,
      cellRenderer: ({ data: o }: { data: ProcurementOrder }) => (
        <div className="cell">
          <b className="mono">{usd(o.totalGrossUsd)}</b>
          <span className="subtext mono">
            {o.quantity} × {usd(o.unitPriceUsd)}
          </span>
        </div>
      ),
    },
    {
      headerName: "Spend guardrail",
      field: "guardrailStatus",
      width: 168,
      cellRenderer: ({ data: o }: { data: ProcurementOrder }) => (
        <div className="center-cell">
          {o.guardrailStatus === "AWAITING_CFO_APPROVAL" ? (
            <button
              disabled={busy}
              className="badge amber"
              onClick={() => next(o, true)}
            >
              Approve {usd(o.totalGrossUsd)} ↗
            </button>
          ) : (
            <span className="badge green">
              <Check size={12} />
              {o.guardrailStatus === "CFO_APPROVED"
                ? "CFO approved"
                : "Auto-cleared"}
            </span>
          )}
        </div>
      ),
    },
    {
      headerName: "PayPal catalog & invoice",
      field: "paypalInvoiceId",
      width: 195,
      cellRenderer: ({ data: o }: { data: ProcurementOrder }) => (
        <div className="cell">
          <button
            className="link mono truncate"
            onClick={() => {
              setSelectedId(o.id);
              setSheet("invoice");
            }}
          >
            {o.paypalInvoiceId || "Creating invoice…"} ↗
          </button>
          <span className="subtext mono truncate">{o.paypalCatalogId}</span>
        </div>
      ),
    },
    {
      headerName: "Order & capture",
      field: "paypalOrderId",
      width: 200,
      cellRenderer: ({ data: o }: { data: ProcurementOrder }) => (
        <div className="cell">
          <span className="mono truncate">
            {o.paypalOrderId || "Awaiting authorization"}
          </span>
          <span className="subtext mono truncate">
            {o.paypalCaptureId || "No capture yet"}
          </span>
        </div>
      ),
    },
    {
      headerName: "Carrier & SLA",
      field: "shipmentStatus",
      width: 175,
      cellRenderer: ({ data: o }: { data: ProcurementOrder }) => (
        <div className="cell">
          <span>
            {o.carrier ? (
              <>
                <Truck size={13} /> {o.carrier}
              </>
            ) : (
              "Awaiting dispatch"
            )}
          </span>
          <span
            className={`badge ${o.slaRiskScore > 70 ? "rose" : o.carrier ? "blue" : "neutral"}`}
          >
            {o.slaRiskScore > 70
              ? "Delivery exception"
              : o.carrier
                ? "In transit · on time"
                : "Not dispatched"}{" "}
            · {o.slaRiskScore}
          </span>
        </div>
      ),
    },
    {
      headerName: "SLA refund & net",
      field: "slaRefundAmountUsd",
      width: 178,
      cellRenderer: ({ data: o }: { data: ProcurementOrder }) => (
        <div className="cell">
          {o.slaRefundAmountUsd ? (
            <>
              <b className="mono green-text">− {usd(o.slaRefundAmountUsd)}</b>
              <button
                className="link subtext"
                onClick={() => {
                  setSelectedId(o.id);
                  setSheet("quotes");
                }}
              >
                Net {usd(o.netSettledUsd)} · Dossier ↗
              </button>
            </>
          ) : (
            <>
              <span className="subtext">No rebate triggered</span>
              <span className="subtext mono">Net: unsettled</span>
            </>
          )}
        </div>
      ),
    },
    {
      headerName: "Next lifecycle action",
      colId: "action",
      width: 173,
      pinned: "right",
      cellRenderer: ({ data: o }: { data: ProcurementOrder }) => (
        <div className="center-cell">
          <button
            disabled={busy}
            className={`row-action ${o.stage === "4_SLA_SETTLED" ? "settled" : ""}`}
            onClick={() =>
              next(o, o.guardrailStatus === "AWAITING_CFO_APPROVAL")
            }
          >
            {o.stage === "1_INVOICED"
              ? o.guardrailStatus === "AWAITING_CFO_APPROVAL"
                ? "Approve & capture"
                : "Capture payment"
              : o.stage === "2_ESCROW_CAPTURED"
                ? "Attach tracking"
                : o.stage === "3_IN_TRANSIT"
                  ? "Run SLA audit"
                  : "View evidence"}
            <ChevronRight size={14} />
          </button>
        </div>
      ),
    },
    { field: "stage", hide: true, filter: "agTextColumnFilter" },
  ];
  const gross = orders.reduce((s, o) => s + o.totalGrossUsd, 0),
    refunds = orders.reduce(
      (s, o) =>
        s + (o.refundStatus === "COMPLETED" ? o.slaRefundAmountUsd || 0 : 0),
      0,
    ),
    tracked = orders.filter((o) => o.trackingNumber).length,
    verified = orders.reduce(
      (s, o) =>
        s +
        Number(!!o.paypalCatalogId) +
        Number(!!o.paypalInvoiceId) +
        Number(!!o.paypalOrderId),
      0,
    );
  const chartOptions: AgChartOptions = {
    data: orders
      .slice(0, 8)
      .map((o) => ({
        name: o.id.slice(-4),
        settled: o.stage === "4_SLA_SETTLED" ? o.netSettledUsd : 0,
        active: ["2_ESCROW_CAPTURED", "3_IN_TRANSIT"].includes(o.stage)
          ? o.totalGrossUsd
          : 0,
        rebate: o.refundStatus === "COMPLETED" ? o.slaRefundAmountUsd || 0 : 0,
      })),
    background: { fill: "#ffffff" },
    padding: { top: 12, bottom: 8, left: 8, right: 16 },
    series: [
      {
        type: "bar",
        direction: "horizontal",
        xKey: "name",
        yKey: "settled",
        yName: "Net settled",
        stacked: true,
        fill: "#1d4ed8",
        strokeWidth: 0,
      },
      {
        type: "bar",
        direction: "horizontal",
        xKey: "name",
        yKey: "active",
        yName: "Active escrow",
        stacked: true,
        fill: "#93c5fd",
        strokeWidth: 0,
      },
      {
        type: "bar",
        direction: "horizontal",
        xKey: "name",
        yKey: "rebate",
        yName: "SLA rebates",
        stacked: true,
        fill: "#10b981",
        strokeWidth: 0,
      },
    ],
    legend: {
      position: "bottom",
      item: { label: { fontSize: 10, color: "#64748b" } },
    },
  };
  function download() {
    const data = {
      orderId: selected.id,
      invoiceId: selected.paypalInvoiceId,
      captureId: selected.paypalCaptureId,
      refundId: selected.paypalRefundId,
      mode: selected.mode,
      ...selected.disputeDossier,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected.id}-evidence.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <Layers3 size={23} />
          </span>
          PactPay
          <span className="brand-divider" />
          <span className="brand-caption">Procurement, with proof.</span>
        </Link>
        <div className="top-actions">
          <button
            className={`connection ${connection?.connected ? "connected" : ""}`}
            onClick={() => setSheet("credentials")}
          >
            <span className="status-dot" />
            {connection?.connected
              ? `PayPal Sandbox · Connected (${connection.latencyMs}ms)`
              : "PayPal Sandbox · Ready to connect"}
            <ChevronRight size={13} />
          </button>
          <span className="avatar">AM</span>
        </div>
      </header>
      <div className="nav-strip">
        <nav>
          {[
            ["ledger", "Procurement ledger"],
            ["suppliers", "Supplier quotes & AI handoffs"],
            ["telemetry", "API telemetry & sandbox logs"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={view === key ? "active" : ""}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button className="quiet" onClick={() => setSheet("telemetry")}>
          <SlidersHorizontal size={14} /> Open inspector
        </button>
      </div>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">WORKSPACE / PROCUREMENT OPERATIONS</div>
            <h1>Every purchase. Accounted for.</h1>
            <p>
              From the right supplier to the last mile. Your treasury, working
              together.
            </p>
          </div>
          <div className="heading-right">
            <span className="badge neutral">USD workspace</span>
            <span className="subtext">
              {orders.length} purchase orders · Sandbox only
            </span>
          </div>
        </div>
        <div className="sponsor-row">
          <span>BUILT WITH</span>
          {[
            "PayPal 6-API engine",
            "Channel3 MCP",
            "AG Grid + AG Studio pattern",
            "APIMatic SDK spec",
          ].map((x) => (
            <span className="sponsor" key={x}>
              <span className="tiny-square" />
              {x}
            </span>
          ))}
          <span className="demo-label">
            {connection?.connected
              ? "Live Sandbox available"
              : "Simulation workspace · no real funds"}
          </span>
        </div>
        {error && (
          <div role="alert" className="error-banner">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={15} />
            </button>
          </div>
        )}
        <section className="walkthrough card">
          <div className="walkthrough-intro">
            <span className="eyebrow blue-text">
              <Play size={12} /> THE 60-SECOND WALKTHROUGH
            </span>
            <h3>One purchase. Four accountable steps.</h3>
            <span className="subtext">
              Follow the money, then the shipment.
            </span>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void autopilot()}
            >
              {busy ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <Play size={13} />
              )}{" "}
              Run full 4-step autopilot
            </button>
          </div>
          <div className="steps">
            {stageNames.map((name, i) => (
              <button
                key={name}
                disabled={busy || (!selected && i > 0)}
                className={`step ${demoStep === i ? "running" : ""} ${selected && Number(selected.stage[0]) > i ? "done" : ""}`}
                onClick={() =>
                  i === 0
                    ? void perform(async () => {
                        await source();
                      })
                    : selected && Number(selected.stage[0]) === i
                      ? next(selected)
                      : setToast(
                          "Advance the selected purchase in lifecycle order.",
                        )
                }
              >
                <span className="step-number">
                  {selected && Number(selected.stage[0]) > i ? (
                    <Check size={17} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <b>{name}</b>
                <span>
                  {
                    [
                      "Channel3 + Catalog + Invoicing",
                      "CFO guardrail + Orders v2",
                      "Shipping Trackers v1",
                      "Refunds + Disputes v1",
                    ][i]
                  }
                </span>
                <span className="step-state">
                  {demoStep === i
                    ? "Processing…"
                    : selected && Number(selected.stage[0]) > i
                      ? "Complete"
                      : selected && Number(selected.stage[0]) === i
                        ? "Up next"
                        : "Pending"}
                  <ArrowRight size={12} />
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="composer card">
          <div className="section-label">
            <span>
              <Zap size={15} /> START A PROCUREMENT
            </span>
            <span>Natural language → accountable execution</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void perform(async () => {
                await source();
              });
            }}
          >
            <div className="prompt-input">
              <Search size={19} />
              <input
                aria-label="Procurement request"
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  requestKey.current = null;
                }}
                required
              />
              <button
                className="primary"
                disabled={busy || !prompt.trim()}
                type="submit"
              >
                {busy ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <Plus size={16} />
                )}{" "}
                Source & invoice
              </button>
            </div>
            <div className="composer-bottom">
              <div className="preset-list">
                <span>Try</span>
                {presets.map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => {
                      setPrompt(`Procure ${p}`);
                      requestKey.current = null;
                    }}
                  >
                    {p}
                    <ArrowUpRight size={11} />
                  </button>
                ))}
              </div>
              <label className="guardrail">
                <ShieldCheck size={14} /> Auto-approval limit
                <input
                  aria-label="CFO auto-approval spend guardrail"
                  type="range"
                  min="1000"
                  max="25000"
                  step="500"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                />
                <strong className="mono">
                  {usd(budget).replace(".00", "")}
                </strong>
              </label>
            </div>
          </form>
          <div className="pipeline">
            {[
              {
                agent: "01 / SOURCING",
                title:
                  selected?.selectedQuote.supplierName ||
                  "Compare three suppliers",
                detail: selected
                  ? `${selected.selectedQuote.selectionScore}/100 match · ${selected.selectedQuote.leadTimeDays}-day lead time`
                  : "Price, reliability and SLA terms",
                icon: <Search size={16} />,
              },
              {
                agent: "02 / TREASURY",
                title:
                  selected?.paypalInvoiceId || "Catalog → invoice → capture",
                detail:
                  selected?.guardrailStatus
                    .replaceAll("_", " ")
                    .toLowerCase() || "Guardrails before every payment",
                icon: <ShieldCheck size={16} />,
              },
              {
                agent: "03 / SLA AUDITOR",
                title: selected?.slaRefundAmountUsd
                  ? `${usd(selected.slaRefundAmountUsd)} rebate recovered`
                  : "Protect the purchase",
                detail: selected
                  ? `${selected.selectedQuote.slaPenaltyPercent}% contractual SLA penalty`
                  : "Tracking signals → partial refund",
                icon: <ArrowDownLeft size={16} />,
              },
            ].map((p, i) => (
              <div className="pipeline-item" key={p.agent}>
                <span className={`pipeline-icon p${i}`}>{p.icon}</span>
                <div>
                  <span className="eyebrow">{p.agent}</span>
                  <b className={i === 1 ? "mono" : ""}>{p.title}</b>
                  <span className="subtext">{p.detail}</span>
                </div>
                {i < 2 && <ChevronRight className="pipeline-arrow" size={16} />}
              </div>
            ))}
          </div>
        </section>
        <section className="metrics">
          {[
            {
              label: "Gross committed escrow",
              value: usd(gross),
              foot: `${orders.filter((o) => o.stage !== "4_SLA_SETTLED").length} active purchases`,
              icon: <Layers3 size={17} />,
            },
            {
              label: "PayPal references verified",
              value: String(verified).padStart(2, "0"),
              foot: "Catalog + invoice + order records",
              icon: <ShieldCheck size={17} />,
            },
            {
              label: "Shipments monitored",
              value: String(tracked).padStart(2, "0"),
              foot: `${orders.filter((o) => o.shipmentStatus === "IN_TRANSIT_ON_TIME").length} on time · ${orders.filter((o) => o.shipmentStatus === "EXCEPTION_DAMAGED_DELAYED").length} exception`,
              icon: <Truck size={17} />,
            },
            {
              label: "SLA refunds recovered",
              value: usd(refunds),
              foot: "Returned through PayPal Refunds v2",
              icon: <ArrowDownLeft size={17} />,
            },
          ].map((m, i) => (
            <article
              className={`metric card ${i === 3 ? "recovery" : ""}`}
              key={m.label}
            >
              <div>
                {m.label}
                {m.icon}
              </div>
              <strong className="mono">{m.value}</strong>
              <span>{m.foot}</span>
            </article>
          ))}
        </section>
        {view === "ledger" ? (
          <>
            <div className="workspace-lower">
              <section className="card ledger">
                <div className="ledger-title">
                  <div>
                    <h2>
                      Procurement ledger{" "}
                      <span className="count">{orders.length}</span>
                    </h2>
                    <p>
                      Your commitments, from first quote to final settlement.
                    </p>
                  </div>
                  <span className="badge neutral">
                    <span className="status-dot" /> All systems ready
                  </span>
                </div>
                <form
                  className="grid-assistant"
                  onSubmit={(e) => {
                    e.preventDefault();
                    applyFilter(query);
                  }}
                >
                  <span className="assistant-icon">
                    <Zap size={15} />
                  </span>
                  <label htmlFor="grid-query">Ask your ledger</label>
                  <input
                    id="grid-query"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={"Try “show orders over $5,000”"}
                  />
                  <button
                    type="submit"
                    aria-label="Apply natural language filter"
                  >
                    <ArrowRight size={17} />
                  </button>
                  <span className="subtext">AG Studio pattern</span>
                </form>
                <div className="filters">
                  <button
                    className={!filter ? "filter-active" : ""}
                    onClick={() => applyFilter("")}
                  >
                    All purchases
                  </button>
                  {["Awaiting approval", "In transit", "SLA refunded"].map(
                    (f) => (
                      <button
                        key={f}
                        className={filter === f ? "filter-active" : ""}
                        onClick={() => applyFilter(f)}
                      >
                        {f}
                      </button>
                    ),
                  )}
                  {filter && (
                    <button
                      className="active-filter"
                      onClick={() => applyFilter("")}
                    >
                      {filter} <X size={12} />
                    </button>
                  )}
                  <span className="subtext">Select a row to inspect →</span>
                </div>
                <div className="grid-wrap">
                  <AgGridReact<ProcurementOrder>
                    theme={gridTheme}
                    rowData={orders}
                    columnDefs={columns}
                    defaultColDef={{
                      sortable: true,
                      resizable: true,
                      filter: "agTextColumnFilter",
                    }}
                    getRowId={(p) => p.data.id}
                    onGridReady={(e) => {
                      api.current = e.api;
                    }}
                    onRowClicked={(e) => {
                      if (e.data) setSelectedId(e.data.id);
                    }}
                    getRowStyle={(p) =>
                      p.data?.id === selectedId
                        ? { backgroundColor: "#F5F9FF" }
                        : undefined
                    }
                    overlayNoRowsTemplate="<span>Loading your procurement workspace…</span>"
                  />
                </div>
                <div className="ledger-footer">
                  <span>
                    <ShieldCheck size={12} /> Session-isolated ledger ·{" "}
                    {orders.length} records
                  </span>
                  <span>Amounts in USD · Demo records are simulated</span>
                </div>
              </section>
            </div>
            <div className="bottom-grid">
              <section className="card chart-card">
                <div className="small-card-heading">
                  <div>
                    <h3>Where the money stands</h3>
                    <p>Settlement, working capital and recovered value.</p>
                  </div>
                  <span className="badge neutral">By purchase order</span>
                </div>
                <AgCharts options={chartOptions} style={{ height: 220 }} />
              </section>
              <section className="card activity">
                <div className="small-card-heading">
                  <div>
                    <h3>A clear chain of accountability</h3>
                    <p>{selected?.id} · Agent handoffs</p>
                  </div>
                  <button className="link" onClick={() => setSheet("quotes")}>
                    Inspect <ArrowUpRight size={13} />
                  </button>
                </div>
                {selected?.agentTimeline
                  .slice(-3)
                  .reverse()
                  .map((t) => (
                    <div className="activity-row" key={t.id}>
                      <span className="activity-dot" />
                      <div>
                        <b>{t.title}</b>
                        <p>{t.detail}</p>
                        <span className="eyebrow">
                          {t.agent} ·{" "}
                          {new Date(t.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
              </section>
            </div>
          </>
        ) : view === "suppliers" ? (
          <section className="card full-panel">
            <div className="small-card-heading">
              <div>
                <h2>Supplier intelligence & agent handoffs</h2>
                <p>
                  Compare three offers and inspect the reasoning behind every
                  purchase.
                </p>
              </div>
            </div>
            {orders.map((o) => (
              <button
                className="supplier-row"
                key={o.id}
                onClick={() => {
                  setSelectedId(o.id);
                  setSheet("quotes");
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.selectedQuote.imageUrl} alt="" />
                <div>
                  <b>{o.selectedQuote.title}</b>
                  <p>
                    {o.selectedQuote.supplierName} · {o.id}
                  </p>
                </div>
                <span className="mono">{usd(o.unitPriceUsd)} / unit</span>
                <span className="badge green">
                  {o.selectedQuote.selectionScore}/100 match
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </section>
        ) : (
          <section className="card full-panel">
            <h2>API telemetry & Sandbox logs</h2>
            <p className="subtext">
              Every payload, status and latency. Secrets are redacted before
              logging.
            </p>
            <Telemetry logs={logs} />
          </section>
        )}
        <footer>
          <span className="brand small">
            <Layers3 size={17} /> PactPay
          </span>
          <span>Autonomous procurement. Human guardrails.</span>
          <span>PayPal AI Hackathon 2026 · Sandbox workspace</span>
        </footer>
      </main>
      {toast && (
        <div role="status" className="toast">
          <Check size={17} />
          {toast}
        </div>
      )}
      {sheet && (
        <div className="overlay" onClick={() => setSheet(null)}>
          <aside
            className={`drawer ${sheet === "credentials" ? "modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              sheet === "credentials"
                ? "Sandbox credentials"
                : `${sheet} inspector`
            }
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSheet(null);
            }}
          >
            <div className="drawer-top">
              <span className="eyebrow">
                PACTPAY /{" "}
                {sheet === "credentials"
                  ? "SANDBOX CONNECTION"
                  : "PURCHASE INSPECTOR"}
              </span>
              <button
                autoFocus
                className="icon-button"
                aria-label="Close inspector"
                onClick={() => setSheet(null)}
              >
                <X size={20} />
              </button>
            </div>
            {sheet === "credentials" ? (
              <>
                <h2>Connect your Sandbox.</h2>
                <p>
                  Use a PayPal Sandbox business app. Keys stay in memory for
                  this tab and are never saved in the ledger.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void perform(async () => {
                      const c =
                        clientId || clientSecret
                          ? { clientId, clientSecret }
                          : undefined;
                      const result = await post("/api/paypal/verify", c || {});
                      setConnection(result);
                      if (result.connected) {
                        setCredentials(c);
                        setClientSecret("");
                        setToast(`Sandbox connected · ${result.latencyMs}ms`);
                      } else if (result.error) throw new Error(result.error);
                      else {
                        setCredentials(undefined);
                        setToast(
                          "No environment keys found. Simulation is ready.",
                        );
                      }
                      await refresh();
                    });
                  }}
                >
                  <label>
                    Sandbox Client ID
                    <input
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Sandbox Client Secret
                    <input
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <button className="primary full" disabled={busy}>
                    Test OAuth connection <ArrowRight size={15} />
                  </button>
                </form>
                <button
                  className="secondary full"
                  onClick={() => {
                    setCredentials({ clientId: "", clientSecret: "" });
                    setConnection(null);
                    setClientId("");
                    setClientSecret("");
                    setSheet(null);
                  }}
                >
                  Use deterministic simulation
                </button>
                <div className="notice">
                  Empty fields test server environment credentials. Existing
                  demo purchases stay simulated; create a new purchase to use
                  live credentials.
                </div>
                {connection && (
                  <div className="connection-result mono">
                    {connection.mode} · {connection.latencyMs}ms
                  </div>
                )}
              </>
            ) : sheet === "telemetry" ? (
              <>
                <h2>Every API call, in the open.</h2>
                <p>
                  Inspect requests and responses across all six PayPal APIs.
                </p>
                <Telemetry logs={logs} />
              </>
            ) : selected && sheet === "invoice" ? (
              <>
                <div className="invoice-brand">
                  Pay<span>Pal</span>
                  <span className="badge blue">SANDBOX INVOICE</span>
                </div>
                <h2>Milestone invoice</h2>
                <p className="mono">{selected.paypalInvoiceNumber}</p>
                <div className="invoice-parties">
                  <div>
                    <span className="eyebrow">SUPPLIER</span>
                    <b>{selected.selectedQuote.supplierName}</b>
                    <span>{selected.selectedQuote.supplierLocation}</span>
                  </div>
                  <div>
                    <span className="eyebrow">BILL TO</span>
                    <b>{selected.requesterDept}</b>
                    <span>PactPay procurement workspace</span>
                  </div>
                </div>
                <div className="invoice-line">
                  <div>
                    <b>{selected.selectedQuote.title}</b>
                    <p className="mono">{selected.selectedQuote.sku}</p>
                    <span className="mono subtext">
                      {selected.paypalCatalogId}
                    </span>
                  </div>
                  <strong className="mono">
                    {selected.quantity} × {usd(selected.unitPriceUsd)}
                  </strong>
                </div>
                <div className="invoice-total">
                  <span>Invoice total</span>
                  <strong className="mono">
                    {usd(selected.totalGrossUsd)}
                  </strong>
                </div>
                <div className="qr-block">
                  <QRCodeSVG
                    value={
                      selected.paypalInvoiceUrl ||
                      "https://www.sandbox.paypal.com/"
                    }
                    size={122}
                  />
                  <div>
                    <span className="badge blue">PAY_BY_BANK preference</span>
                    <h3>One invoice. A traceable payment.</h3>
                    <p>
                      Bank eligibility is determined by PayPal. Use Checkout for
                      this workflow; do not also pay this reference invoice.
                    </p>
                    {selected.mode === "LIVE_SANDBOX" ? (
                      <a
                        className="link"
                        href={selected.paypalInvoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View invoice at PayPal <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="badge neutral">
                        Simulated QR · not a payable invoice
                      </span>
                    )}
                  </div>
                </div>
                {selected.approveUrl && (
                  <a
                    className="primary full"
                    target="_blank"
                    rel="noreferrer"
                    href={selected.approveUrl}
                  >
                    Approve at PayPal Sandbox <ExternalLink size={14} />
                  </a>
                )}
                <button
                  className="primary full"
                  disabled={busy || selected.stage !== "1_INVOICED"}
                  onClick={() =>
                    next(
                      selected,
                      selected.guardrailStatus === "AWAITING_CFO_APPROVAL",
                    )
                  }
                >
                  {selected.guardrailStatus === "AWAITING_CFO_APPROVAL"
                    ? "CFO approve & authorize"
                    : selected.approveUrl
                      ? "I approved — capture payment"
                      : "Authorize & capture in Sandbox"}
                  <ArrowRight size={15} />
                </button>
                <div className="notice">
                  Captured funds are represented in an internal milestone
                  ledger. PayPal Checkout is not a regulated escrow account.
                </div>
              </>
            ) : selected && sheet === "quotes" ? (
              <>
                <h2>The reasoning behind the purchase.</h2>
                <p>
                  {selected.id} · {selected.quantity} units ·{" "}
                  {selected.requesterDept}
                </p>
                <div className="notice">
                  {selected.selectedQuote.source === "DEMO_CATALOG"
                    ? "Deterministic wholesale demo quotes."
                    : "Channel3 live discovery."}{" "}
                  Supplier delivery, stock, warranty and SLA terms are
                  illustrative and require confirmation.
                </div>
                <div className="quote-list">
                  {selected.competingQuotes.map((q) => (
                    <article
                      className={`quote-card ${q.id === selected.selectedQuote.id ? "winner" : ""}`}
                      key={q.id}
                    >
                      <div className="quote-title">
                        <b>{q.supplierName}</b>
                        <span
                          className={`badge ${q.id === selected.selectedQuote.id ? "green" : "neutral"}`}
                        >
                          {q.id === selected.selectedQuote.id
                            ? "Selected · "
                            : ""}
                          {q.selectionScore}/100
                        </span>
                      </div>
                      <p>
                        {q.supplierLocation} · {q.brand}
                      </p>
                      <strong className="mono quote-price">
                        {usd(q.unitPriceUsd)}
                        <span>/ unit</span>
                      </strong>
                      <div className="quote-stats">
                        <span>
                          {q.leadTimeDays} days<b>Lead time</b>
                        </span>
                        <span>
                          {q.onTimeDeliveryRate}%<b>On time</b>
                        </span>
                        <span>
                          {q.slaPenaltyPercent}%<b>SLA rebate</b>
                        </span>
                      </div>
                      <p>
                        MOQ {q.moq} · {q.inStockCount} available ·{" "}
                        {q.warrantyYears}-year warranty
                      </p>
                      <p>{q.selectionRationale}</p>
                    </article>
                  ))}
                </div>
                <h3>Dispute & SLA evidence dossier</h3>
                {selected.disputeDossier ? (
                  <>
                    <div className="dossier">
                      <span className="badge green">
                        Refund {selected.refundStatus}
                      </span>
                      <p>{selected.disputeDossier.contractClause}</p>
                      <p>{selected.disputeDossier.carrierProof}</p>
                      <dl>
                        <dt>Gross order</dt>
                        <dd>{usd(selected.totalGrossUsd)}</dd>
                        <dt>SLA recovery</dt>
                        <dd className="green-text">
                          − {usd(selected.slaRefundAmountUsd || 0)}
                        </dd>
                        <dt>Final net settled</dt>
                        <dd>{usd(selected.netSettledUsd)}</dd>
                      </dl>
                      <p className="mono subtext">{selected.paypalRefundId}</p>
                      <p>
                        Prepared locally. Customer Disputes was read; no dispute
                        or evidence was submitted.
                      </p>
                    </div>
                    <button className="secondary full" onClick={download}>
                      <Download size={15} /> Download evidence JSON
                    </button>
                  </>
                ) : (
                  <p className="notice">
                    The evidence packet is assembled after a completed SLA
                    refund.
                  </p>
                )}
                <h3>Agent timeline</h3>
                {selected.agentTimeline.map((t) => (
                  <div className="timeline-entry" key={t.id}>
                    <span className="eyebrow">{t.agent}</span>
                    <b>{t.title}</b>
                    <p>{t.detail}</p>
                    <code>{t.apiEndpoint}</code>
                  </div>
                ))}
              </>
            ) : (
              selected && (
                <>
                  <h2>
                    {sheet === "tracking"
                      ? "Bind shipment tracking"
                      : "Document the SLA exception"}
                  </h2>
                  <p>{selected.id} · Live Sandbox</p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void perform(async () => {
                        await advance(
                          selected,
                          sheet === "tracking"
                            ? { trackingNumber: tracking, carrier }
                            : { exceptionReport: exception },
                        );
                        setSheet(null);
                      });
                    }}
                  >
                    {sheet === "tracking" ? (
                      <>
                        <label>
                          Carrier
                          <select
                            value={carrier}
                            onChange={(e) => setCarrier(e.target.value)}
                          >
                            {["FEDEX", "UPS", "DHL"].map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Tracking number
                          <input
                            required
                            minLength={6}
                            value={tracking}
                            onChange={(e) => setTracking(e.target.value)}
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <label>
                          Carrier exception report
                          <textarea
                            required
                            minLength={10}
                            value={exception}
                            onChange={(e) => setException(e.target.value)}
                          />
                        </label>
                        <div className="notice">
                          This issues a{" "}
                          {selected.selectedQuote.slaPenaltyPercent}% Sandbox
                          refund of{" "}
                          {usd(
                            (selected.totalGrossUsd *
                              selected.selectedQuote.slaPenaltyPercent) /
                              100,
                          )}
                          . Confirm that the supplied report supports the agreed
                          SLA.
                        </div>
                      </>
                    )}
                    <button className="primary full" disabled={busy}>
                      {sheet === "tracking"
                        ? "Attach shipment tracking"
                        : "Issue SLA partial refund"}
                    </button>
                  </form>
                </>
              )
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
function Telemetry({ logs }: { logs: TelemetryLog[] }) {
  return (
    <div className="telemetry-list">
      {logs.map((l) => (
        <details className="telemetry-item" key={l.id}>
          <summary>
            <span className={`badge ${l.status < 400 ? "green" : "rose"}`}>
              {l.status}{" "}
              {l.status === 201 ? "CREATED" : l.status < 400 ? "OK" : "ERROR"}
            </span>
            <b>{l.apiName}</b>
            <span className="mono subtext">{l.durationMs}ms</span>
            <ChevronRight size={13} />
          </summary>
          <div className="telemetry-meta">
            <span className="badge neutral">{l.mode}</span>
            <span className="mono">
              {l.method} {l.endpoint}
            </span>
            <span>{new Date(l.timestamp).toLocaleString()}</span>
          </div>
          <h4>Request</h4>
          <pre>{JSON.stringify(l.requestBody, null, 2)}</pre>
          <h4>Response</h4>
          <pre>{JSON.stringify(l.responseBody, null, 2)}</pre>
        </details>
      ))}
    </div>
  );
}
