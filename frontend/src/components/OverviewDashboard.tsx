import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  ArrowUpRight, 
  FileText, 
  Disc, 
  Wrench, 
  ChevronRight, 
  AlertTriangle,
  RotateCcw,
  Sparkles,
  BarChart4,
  Plus
} from 'lucide-react';
import { GlobalFilters } from '../App.tsx';

interface OverviewDashboardProps {
  filters: GlobalFilters;
  onNavigateToTab: (tab: string) => void;
}

interface OverviewData {
  metrics: {
    totalRevenue: number;
    totalInvoices: number;
    avgInvoiceValue: number;
    tireQtySold: number;
    servicesPerformed: number;
    understeelReplaced: number;
  };
  trends: { date: string; revenue: number }[];
  proportion: { category: string; revenue: number }[];
  topItems: {
    Barang: { item_name: string; qty: number; revenue: number }[];
    Jasa: { item_name: string; qty: number; revenue: number }[];
    Understeel: { item_name: string; qty: number; revenue: number }[];
  };
}

export default function OverviewDashboard({ filters, onNavigateToTab }: OverviewDashboardProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.salesPerson) params.append('salesPerson', filters.salesPerson);
    if (filters.carBrand) params.append('carBrand', filters.carBrand);
    if (filters.carSeries) params.append('carSeries', filters.carSeries);
    if (filters.carYear) params.append('carYear', filters.carYear);

    try {
      const res = await fetch(`/api/analytics/overview?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.errors.join(', '));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [filters]);

  if (loading) {
    return (
      <div className="empty-state" style={{ padding: '8rem 2rem' }}>
        <span className="empty-icon">⏳</span>
        <p>Menghitung dan memproses metrik ringkasan outlet...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="empty-state" style={{ padding: '4rem 2rem', borderColor: 'var(--color-cancelled)' }}>
        <AlertTriangle size={36} style={{ color: 'var(--color-cancelled)', marginBottom: '1rem' }} />
        <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Gagal Memuat Dashboard</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '400px' }}>
          Terjadi kesalahan saat memproses data agregasi database: {error || 'Koneksi terputus.'}
        </p>
        <button className="btn btn-primary" onClick={fetchOverview}>
          <RotateCcw size={14} /> Coba Lagi
        </button>
      </div>
    );
  }

  const { metrics, trends, proportion, topItems } = data;

  // Render SVG Trend Line
  const renderTrendChart = () => {
    if (trends.length === 0) {
      return (
        <div style={{ display: 'flex', height: '200px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dark)', fontStyle: 'italic', fontSize: '0.875rem' }}>
          Tidak ada data tren untuk periode terpilih.
        </div>
      );
    }

    const width = 500;
    const height = 180;
    const padding = 25;
    
    const maxVal = Math.max(...trends.map(t => t.revenue), 100000);
    const minVal = 0;

    const points = trends.map((t, idx) => {
      const x = padding + (idx / Math.max(1, trends.length - 1)) * (width - padding * 2);
      const y = height - padding - ((t.revenue - minVal) / (maxVal - minVal)) * (height - padding * 2);
      return { x, y, date: t.date, revenue: t.revenue };
    });

    const pathData = points.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    // Area below line
    const areaPath = trends.length > 0 
      ? `${pathData} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
      : '';

    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="200" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          
          {/* Y Axis helper lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--border-subtle)" strokeDasharray="3" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="var(--border-subtle)" strokeDasharray="3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border-subtle)" />

          {/* Area under curve */}
          {areaPath && <path d={areaPath} fill="url(#areaGradient)" />}

          {/* Curve */}
          {pathData && (
            <path 
              d={pathData} 
              fill="none" 
              stroke="var(--primary)" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          )}

          {/* Interactive dots */}
          {points.map((p, i) => (
            <g key={i} className="chart-dot-group">
              <circle cx={p.x} cy={p.y} r="4" fill="var(--bg-main)" stroke="var(--primary)" strokeWidth="2" />
              <title>{`${p.date}: Rp ${p.revenue.toLocaleString('id-ID')}`}</title>
            </g>
          ))}
        </svg>
        
        {/* Date labels at bottom */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-dark)', padding: '0 10px', marginTop: '4px' }}>
          <span>{trends[0]?.date || ''}</span>
          <span>{trends[Math.floor(trends.length / 2)]?.date || ''}</span>
          <span>{trends[trends.length - 1]?.date || ''}</span>
        </div>
      </div>
    );
  };

  // Render SVG Category Donut Breakdown
  const renderCategoryBreakdown = () => {
    const totalRev = proportion.reduce((acc, p) => acc + p.revenue, 0);
    if (totalRev === 0) {
      return (
        <div style={{ display: 'flex', height: '200px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dark)', fontStyle: 'italic', fontSize: '0.875rem' }}>
          Tidak ada data proporsi penjualan.
        </div>
      );
    }

    // Sort to keep colors consistent
    const sortedProp = [...proportion].sort((a, b) => b.revenue - a.revenue);
    
    // Category visual representation using elegant progress bars
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', justifyContent: 'center' }}>
        {sortedProp.map(item => {
          const pct = (item.revenue / totalRev) * 100;
          let color = 'var(--color-barang)';
          if (item.category === 'Jasa') color = 'var(--color-jasa)';
          if (item.category === 'Understeel') color = 'var(--color-understeel)';

          return (
            <div key={item.category} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
                  {item.category}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Rp {item.revenue.toLocaleString('id-ID')} ({pct.toFixed(1)}%)
                </span>
              </div>
              <div className="score-track" style={{ height: '6px' }}>
                <div className="score-bar" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Welcome Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Sparkles size={18} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem' }}>Ringkasan Kinerja Outlet</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Menyajikan visualisasi pendapatan riil dan item yang terjual pada periode aktif.
          </p>
        </div>
        <button className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={() => onNavigateToTab('input')}>
          <Plus size={16} /> Catat Invoice
        </button>
      </div>

      {/* Primary KPI Scorecards */}
      <div className="scorecards-container">
        
        <div className="card card-accent-green">
          <span className="card-title">TOTAL REVENUE (BRUTO)</span>
          <div className="card-value" style={{ color: 'var(--color-final)' }}>
            Rp {metrics.totalRevenue.toLocaleString('id-ID')}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Berdasarkan <strong>Omset Bruto</strong> dari {metrics.totalInvoices} invoice
          </span>
        </div>

        <div className="card card-accent-blue">
          <span className="card-title">BAN LUAR TERJUAL</span>
          <div className="card-value" style={{ color: 'var(--color-barang)' }}>
            {metrics.tireQtySold} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>pcs</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Hanya menghitung jenis Ban
          </span>
        </div>

        <div className="card card-accent-purple">
          <span className="card-title">JASA DIKERJAKAN</span>
          <div className="card-value" style={{ color: 'var(--color-jasa)' }}>
            {metrics.servicesPerformed} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>layanan</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Volume pekerjaan jasa teknisi
          </span>
        </div>

        <div className="card card-accent-cyan">
          <span className="card-title">UNDERSTEEL DIGANTI</span>
          <div className="card-value" style={{ color: 'var(--color-understeel)' }}>
            {metrics.understeelReplaced} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>part</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Penggantian suku cadang kaki-kaki
          </span>
        </div>

        <div className="card" style={{ borderLeft: '3.5px solid var(--text-muted)' }}>
          <span className="card-title">RATA-RATA BASKET</span>
          <div className="card-value" style={{ fontSize: '1.5rem', marginTop: '0.2rem' }}>
            Rp {Math.round(metrics.avgInvoiceValue).toLocaleString('id-ID')}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Nilai per transaksi invoice
          </span>
        </div>

      </div>

      {/* Visual Analytics Charts Section */}
      <div className="dashboard-grid">
        
        {/* Revenue Trend Line */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={16} style={{ color: 'var(--primary)' }} />
              Tren Pendapatan Harian
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Period</span>
          </div>
          <div style={{ padding: '0.5rem 0' }}>
            {renderTrendChart()}
          </div>
        </div>

        {/* Category Contribution Progress Bars */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart4 size={16} style={{ color: 'var(--secondary)' }} />
              Kontribusi Kategori Bisnis
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Porsi Revenue</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '1rem 0' }}>
            {renderCategoryBreakdown()}
          </div>
        </div>

      </div>

      {/* Top Performing Items Per Category Tables */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.15rem' }}>Top 3 Item per Kategori Bisnis</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Peringkat berdasarkan volume & revenue</span>
        </div>

        <div className="dashboard-grid">
          
          {/* Top Barang */}
          <div className="card" style={{ padding: '1rem', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <strong style={{ fontSize: '0.875rem', color: 'var(--color-barang)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                📦 Top Barang (Ban, Oli, dll)
              </strong>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.2rem 0.4rem', fontSize: '0.6875rem', borderRadius: '4px' }}
                onClick={() => onNavigateToTab('tires')}
              >
                Detail <ChevronRight size={10} />
              </button>
            </div>
            {topItems.Barang.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dark)', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>Tidak ada data barang.</p>
            ) : (
              topItems.Barang.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                  <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                    {idx + 1}. {item.item_name}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
                    {item.qty} pcs <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-dark)' }}>({Math.round(item.revenue/1000).toLocaleString('id-ID')}k)</span>
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Top Jasa */}
          <div className="card" style={{ padding: '1rem', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <strong style={{ fontSize: '0.875rem', color: 'var(--color-jasa)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                ⚙️ Top Pekerjaan Jasa
              </strong>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.2rem 0.4rem', fontSize: '0.6875rem', borderRadius: '4px' }}
                onClick={() => onNavigateToTab('services')}
              >
                Detail <ChevronRight size={10} />
              </button>
            </div>
            {topItems.Jasa.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dark)', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>Tidak ada data jasa.</p>
            ) : (
              topItems.Jasa.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                  <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                    {idx + 1}. {item.item_name}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
                    {item.qty} x <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-dark)' }}>({Math.round(item.revenue/1000).toLocaleString('id-ID')}k)</span>
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Top Understeel */}
          <div className="card" style={{ padding: '1rem', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <strong style={{ fontSize: '0.875rem', color: 'var(--color-understeel)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                🔧 Top Part Understeel
              </strong>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.2rem 0.4rem', fontSize: '0.6875rem', borderRadius: '4px' }}
                onClick={() => onNavigateToTab('understeel')}
              >
                Detail <ChevronRight size={10} />
              </button>
            </div>
            {topItems.Understeel.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dark)', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>Tidak ada data understeel.</p>
            ) : (
              topItems.Understeel.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                  <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                    {idx + 1}. {item.item_name}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
                    {item.qty} pcs <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-dark)' }}>({Math.round(item.revenue/1000).toLocaleString('id-ID')}k)</span>
                  </span>
                </div>
              ))
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
