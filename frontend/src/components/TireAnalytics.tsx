import React, { useState, useEffect } from 'react';
import { Disc, TrendingUp, DollarSign, Award, Grid, ListOrdered } from 'lucide-react';
import { GlobalFilters, MasterData } from '../App.tsx';

interface TireAnalyticsProps {
  filters: GlobalFilters;
  masterData: MasterData;
}

interface TireAnalyticsData {
  metrics: {
    tireQtySold: number;
    tireRevenue: number;
    avgTirePrice: number;
  };
  topCombinations: { tire_brand: string; tire_size: string; qty: number; revenue: number }[];
  topSizes: { tire_size: string; qty: number; revenue: number }[];
  topBrands: { tire_brand: string; qty: number; revenue: number }[];
}

export default function TireAnalytics({ filters, masterData }: TireAnalyticsProps) {
  const [data, setData] = useState<TireAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Local Filters
  const [localSize, setLocalSize] = useState<string>('');
  const [localBrand, setLocalBrand] = useState<string>('');

  const fetchTireAnalytics = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.salesPerson) params.append('salesPerson', filters.salesPerson);
    
    // Override with local filters if set, otherwise fallback to global
    if (localSize) params.append('tireSize', localSize);
    if (localBrand) params.append('tireBrand', localBrand);

    try {
      const res = await fetch(`/api/analytics/tires?${params.toString()}`);
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
    fetchTireAnalytics();
  }, [filters, localSize, localBrand]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Disc size={20} style={{ color: 'var(--color-barang)' }} /> Analitik Ban Luar
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Menganalisis ukuran, merek, kontribusi pendapatan, dan kombinasi ban paling laris.
          </p>
        </div>

        {/* Local Autocomplete Filter */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <select
            className="select-control"
            style={{ width: '150px', fontSize: '0.8125rem' }}
            value={localBrand}
            onChange={e => setLocalBrand(e.target.value)}
          >
            <option value="">-- Semua Merek Ban --</option>
            {masterData.tire_brand.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <select
            className="select-control"
            style={{ width: '160px', fontSize: '0.8125rem' }}
            value={localSize}
            onChange={e => setLocalSize(e.target.value)}
          >
            <option value="">-- Semua Ukuran Ban --</option>
            {masterData.tire_size.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="empty-state" style={{ padding: '6rem 2rem' }}>
          <span className="empty-icon">⏳</span>
          <p>Menganalisis data ban luar...</p>
        </div>
      ) : error || !data ? (
        <div className="empty-state">
          <span className="empty-icon">⚠️</span>
          <p>Gagal memuat analitik ban: {error || 'Terjadi kesalahan server.'}</p>
        </div>
      ) : (
        <>
          {/* Tire KPI Cards */}
          <div className="scorecards-container">
            <div className="card card-accent-blue">
              <span className="card-title">BAN LUAR TERJUAL</span>
              <div className="card-value">
                {data.metrics.tireQtySold} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>pcs</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Hanya final invoice berjenis Ban</span>
            </div>

            <div className="card card-accent-green">
              <span className="card-title">OMSET BRUTO PENJUALAN BAN</span>
              <div className="card-value" style={{ color: 'var(--color-final)' }}>
                Rp {data.metrics.tireRevenue.toLocaleString('id-ID')}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Berdasarkan kolom OMZET BRUTO</span>
            </div>

            <div className="card" style={{ borderLeft: '3.5px solid var(--text-muted)' }}>
              <span className="card-title">RATA-RATA HARGA JUAL</span>
              <div className="card-value" style={{ color: 'var(--primary)' }}>
                Rp {Math.round(data.metrics.avgTirePrice).toLocaleString('id-ID')}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Harga satuan ban rata-rata</span>
            </div>
          </div>

          {/* Grids and Lists */}
          <div className="dashboard-grid">
            
            {/* Top Brand + Size Combinations */}
            <div className="card" style={{ padding: '1.25rem', gap: '0.75rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={16} style={{ color: 'var(--color-draft)' }} />
                10 Kombinasi Ban Terlaris
              </h3>
              
              {data.topCombinations.length === 0 ? (
                <p style={{ fontStyle: 'italic', fontSize: '0.8125rem', color: 'var(--text-dark)', textAlign: 'center', padding: '2rem' }}>Tidak ada data ban terjual.</p>
              ) : (
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Merek</th>
                        <th>Ukuran</th>
                        <th style={{ textAlign: 'right' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Omset Bruto (Rp)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topCombinations.map((comb, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td><strong>{comb.tire_brand}</strong></td>
                          <td>{comb.tire_size}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{comb.qty} pcs</td>
                          <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{comb.revenue.toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Split top sizes and top brands */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Top Sizes */}
              <div className="card" style={{ padding: '1.25rem', gap: '0.75rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Grid size={16} style={{ color: 'var(--color-understeel)' }} />
                  Ukuran Ban Terpopuler
                </h3>
                {data.topSizes.length === 0 ? (
                  <p style={{ fontStyle: 'italic', fontSize: '0.8125rem', color: 'var(--text-dark)', textAlign: 'center', padding: '1rem' }}>Tidak ada data ukuran ban.</p>
                ) : (
                  <div className="table-container" style={{ border: 'none' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>No</th>
                          <th>Ukuran Ban</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>Omset Bruto (Rp)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topSizes.map((size, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td><strong>{size.tire_size}</strong></td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{size.qty} pcs</td>
                            <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{size.revenue.toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Top Brands */}
              <div className="card" style={{ padding: '1.25rem', gap: '0.75rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ListOrdered size={16} style={{ color: 'var(--color-jasa)' }} />
                  Merek Ban Terpopuler
                </h3>
                {data.topBrands.length === 0 ? (
                  <p style={{ fontStyle: 'italic', fontSize: '0.8125rem', color: 'var(--text-dark)', textAlign: 'center', padding: '1rem' }}>Tidak ada data merek ban.</p>
                ) : (
                  <div className="table-container" style={{ border: 'none' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>No</th>
                          <th>Merek Ban</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>Omset Bruto (Rp)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topBrands.map((brand, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td><strong>{brand.tire_brand}</strong></td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{brand.qty} pcs</td>
                            <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{brand.revenue.toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

          </div>
        </>
      )}

    </div>
  );
}
