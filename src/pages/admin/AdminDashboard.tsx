import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import {
  fetchDashboardRecentOrders,
  fetchDashboardStats,
  fetchLowStockProducts,
  fetchRevenueOverview,
  fetchTopSellerProducts,
  type DashboardStats,
  type RevenuePeriod,
  type RevenuePoint,
  type DashboardRecentOrder,
  type LowStockProduct,
  type TopSellerProduct,
  buildStatusLabel,
} from "@/services/adminService";
import {
  formatAdminDate,
  formatCompactCurrency,
  formatCurrency,
  formatRelativeDate,
  trendLabel,
  trendTone,
} from "@/lib/adminFormatting";

const periods: Array<{ label: string; value: RevenuePeriod }> = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "12M", value: "12m" },
];

const statusBadgeClass: Record<string, string> = {
  pending: "border border-[var(--color-border)] text-[var(--color-muted)]",
  confirmed: "border border-[var(--color-primary)] text-[var(--color-primary)]",
  processing: "border border-[var(--color-accent)] text-[var(--color-accent)]",
  shipped: "bg-[var(--color-accent)] text-[var(--color-secondary)]",
  delivered: "bg-[var(--color-primary)] text-[var(--color-secondary)]",
  cancelled: "border border-[var(--color-danger)] text-[var(--color-danger)]",
};

const trendClass = (value: number | null) => {
  const tone = trendTone(value);
  if (tone === "positive") return "text-[var(--color-success)]";
  if (tone === "negative") return "text-[var(--color-danger)]";
  return "text-[var(--color-muted-soft)]";
};

const customTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const revenue = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-[var(--border-radius)] border-none bg-[var(--color-primary)] px-[14px] py-[10px] text-[var(--color-secondary)]">
      <p className="font-body text-[11px]">{label}</p>
      <p className="mt-1 font-body text-[11px]">{formatCurrency(revenue)}</p>
    </div>
  );
};

const StatCard = ({
  value,
  label,
  trend,
}: {
  value: string;
  label: string;
  trend: number | null;
}) => (
  <div className="border-b-2 border-[var(--color-accent)] pb-5">
    <p className="font-display text-[32px] leading-none text-[var(--color-primary)] md:text-[44px]">{value}</p>
    <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)]">{label}</p>
    <p className={`mt-2 font-body text-[11px] ${trendClass(trend)}`}>{trendLabel(trend)}</p>
  </div>
);

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [period, setPeriod] = useState<RevenuePeriod>("30d");
  const [revenueSeries, setRevenueSeries] = useState<RevenuePoint[]>([]);
  const [recentOrders, setRecentOrders] = useState<DashboardRecentOrder[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [topSellers, setTopSellers] = useState<TopSellerProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChartLoading, setIsChartLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setIsLoading(true);
      try {
        const [statsData, ordersData, stockData, topData] = await Promise.all([
          fetchDashboardStats(),
          fetchDashboardRecentOrders(),
          fetchLowStockProducts(),
          fetchTopSellerProducts(),
        ]);
        if (!isMounted) return;
        setStats(statsData);
        setRecentOrders(ordersData);
        setLowStockProducts(stockData);
        setTopSellers(topData);
      } catch {
        if (!isMounted) return;
        setStats(null);
        setRecentOrders([]);
        setLowStockProducts([]);
        setTopSellers([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadChart = async () => {
      setIsChartLoading(true);
      try {
        const data = await fetchRevenueOverview(period);
        if (!isMounted) return;
        setRevenueSeries(data);
      } catch {
        if (!isMounted) return;
        setRevenueSeries([]);
      } finally {
        if (isMounted) {
          setIsChartLoading(false);
        }
      }
    };

    void loadChart();

    return () => {
      isMounted = false;
    };
  }, [period]);

  const statValues = useMemo(() => {
    if (!stats) {
      return {
        revenue: formatCurrency(0),
        ordersToday: "0",
        ordersMonth: "0",
        customers: "0",
      };
    }

    return {
      revenue: formatCurrency(stats.totalRevenue),
      ordersToday: stats.ordersToday.toLocaleString("en-GH"),
      ordersMonth: stats.ordersThisMonth.toLocaleString("en-GH"),
      customers: stats.totalCustomers.toLocaleString("en-GH"),
    };
  }, [stats]);

  return (
    <div className="admin-page">
      <div className="admin-stats-grid grid gap-8 grid-cols-2 md:grid-cols-2 xl:grid-cols-4">
        <StatCard value={statValues.revenue} label="Total Revenue" trend={stats?.totalRevenueTrend ?? null} />
        <StatCard value={statValues.ordersToday} label="Orders Today" trend={stats?.ordersTodayTrend ?? null} />
        <StatCard value={statValues.ordersMonth} label="Orders This Month" trend={stats?.ordersThisMonthTrend ?? null} />
        <StatCard value={statValues.customers} label="Total Customers" trend={stats?.totalCustomersTrend ?? null} />
      </div>

      <section className="mt-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <p className="font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Revenue Overview</p>
          <div className="flex items-center gap-4">
            {periods.map((periodOption) => (
              <button
                key={periodOption.value}
                type="button"
                onClick={() => setPeriod(periodOption.value)}
                className={`border-b font-body text-[10px] uppercase tracking-[0.12em] ${
                  period === periodOption.value ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-transparent text-[var(--color-muted-soft)]"
                }`}
              >
                {periodOption.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dashboard-chart-mobile h-[200px] w-full md:h-[280px]">
          {isChartLoading ? (
            <div className="h-full w-full animate-pulse bg-[var(--color-surface-alt)]" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-surface)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "var(--color-muted-soft)", fontFamily: "var(--font-body)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "var(--color-muted-soft)", fontFamily: "var(--font-body)" }}
                  tickFormatter={(value) => formatCompactCurrency(Number(value))}
                />
                <Tooltip content={customTooltip} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--color-accent)", stroke: "var(--color-secondary)", strokeWidth: 1 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="mt-12 grid gap-10 lg:grid-cols-[3fr_2fr]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Recent Orders</p>
            <Link
              to="/admin/orders"
              className="font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-accent)] transition-colors hover:text-[var(--color-primary)]"
            >
              View All &rarr;
            </Link>
          </div>

          <div className="border-t border-[var(--color-border)]">
            {isLoading ? (
              <div className="space-y-3 py-4">
                <div className="h-14 animate-pulse bg-[var(--color-surface-alt)]" />
                <div className="h-14 animate-pulse bg-[var(--color-surface-alt)]" />
                <div className="h-14 animate-pulse bg-[var(--color-surface-alt)]" />
              </div>
            ) : recentOrders.length === 0 ? (
              <p className="py-6 font-body text-[11px] text-[var(--color-muted-soft)]">No recent orders.</p>
            ) : (
              recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/admin/orders/${order.order_number}`}
                  className="grid grid-cols-[1.2fr_1.8fr_1fr_auto] items-center gap-3 border-b border-[var(--color-border)] py-3"
                >
                  <p className="font-body text-[11px] uppercase tracking-[0.08em] text-[var(--color-accent)]">{order.order_number}</p>
                  <div>
                    <p className="font-body text-[12px] text-[var(--color-primary)]">{order.customer_name}</p>
                    <p className="font-body text-[10px] text-[var(--color-muted-soft)]">{formatRelativeDate(order.created_at)}</p>
                  </div>
                  <p className="justify-self-end font-body text-[12px] text-[var(--color-primary)]">{formatCurrency(order.total)}</p>
                  <span
                    className={`rounded-[var(--border-radius)] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                      statusBadgeClass[order.status] ?? "border border-[var(--color-border)] text-[var(--color-muted)]"
                    }`}
                  >
                    {buildStatusLabel(order.status)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div>
          <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Low Stock</p>
          <div className="border-t border-[var(--color-border)]">
            {isLoading ? (
              <div className="space-y-3 py-4">
                <div className="h-12 animate-pulse bg-[var(--color-surface-alt)]" />
                <div className="h-12 animate-pulse bg-[var(--color-surface-alt)]" />
              </div>
            ) : lowStockProducts.length === 0 ? (
              <p className="py-6 font-body text-[11px] text-[var(--color-muted-soft)]">All products well stocked.</p>
            ) : (
              lowStockProducts.map((product) => {
                const stockColor = product.stock_quantity === 0 ? "text-[var(--color-danger)]" : "text-[var(--color-accent)]";
                return (
                  <div key={product.id} className="flex items-center gap-3 border-b border-[var(--color-border)] py-3">
                    <div className="h-[42px] w-8 overflow-hidden bg-[var(--color-surface-alt)]">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-[var(--color-surface-strong)]" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-body text-[12px] text-[var(--color-primary)]">{product.name}</p>
                      <p className={`font-body text-[11px] ${stockColor}`}>{product.stock_quantity} in stock</p>
                    </div>
                    <Link
                      to={`/admin/products/${product.id}/edit`}
                      className="font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)] transition-colors hover:text-[var(--color-primary)]"
                    >
                      Edit
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Top Sellers This Month</p>
        <div className="border-t border-[var(--color-border)]">
          {isLoading ? (
            <div className="space-y-3 py-4">
              <div className="h-16 animate-pulse bg-[var(--color-surface-alt)]" />
              <div className="h-16 animate-pulse bg-[var(--color-surface-alt)]" />
            </div>
          ) : topSellers.length === 0 ? (
            <p className="py-6 font-body text-[11px] text-[var(--color-muted-soft)]">No top sellers yet.</p>
          ) : (
            topSellers.map((product, index) => (
              <div key={product.id} className="flex items-center gap-4 border-b border-[var(--color-border)] py-4">
                <p className="w-8 font-display text-[32px] text-[var(--color-border)]">{index + 1}</p>
                <div className="h-16 w-12 overflow-hidden bg-[var(--color-surface-alt)]">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-[var(--color-surface-strong)]" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-body text-[12px] text-[var(--color-primary)]">{product.name}</p>
                  <p className="font-body text-[11px] text-[var(--color-muted)]">{product.total_orders} units sold</p>
                </div>
                <p className="font-body text-[12px] text-[var(--color-accent)]">{formatCurrency(product.price * product.total_orders)}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {!isLoading && !stats ? (
        <p className="mt-8 font-body text-[12px] text-[var(--color-danger)]">Dashboard data failed to load. Check your admin RLS policies and data access.</p>
      ) : null}
    </div>
  );
};

export default AdminDashboard;


