import React, { useState, useEffect } from 'react';
import { Car, Grid, TrendingUp, HelpCircle, Activity } from 'lucide-react';
import { GlobalFilters, MasterData } from '../App.tsx';

interface UndersteelAnalyticsProps {
  filters: GlobalFilters;
  masterData: MasterData;
}

interface UndersteelData {
  metrics: {
    understeelQty: number;
    understeelRevenue: number;
  };
  topPartsQty: { item_name: string; qty: number; revenue: number }[];
  topPartsRevenue: { item_name: string; qty: number; revenue: number }[];
  matrix: { part_name: string; car_brand: string; car_series: string; qty: number; invoice_count: number; revenue: number }[];
}

export default function UndersteelAnalytics({ filters, masterData }: UndersteelAnalyticsProps) {
  const [data, setData] = useState<UndersteelData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Local Filters
  const [localPart, setLocalPart] = useState<string>('');
  const [localPos, setLocalPos] = useState<string>('');

  const fetchUndersteel = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.salesPerson) params.append('salesPerson', filters.salesPerson);
    if (filters.carBrand) params.append('carBrand', filters.carBrand);
    if (filters.carSeries) params.append('carSeries', filters.carSeries);
    if (filters.carYear) params.append('carYear', filters.carYear);

    // Local overrides
    if (localPart) params.append('partName', localPart);
    if (localPos) params.append('position', localPos);

    try {
      const res = await fetch(`/api/analytics/understeel?${params.toString()}`);
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
    fetchUndersteel();
  }, [filters, localPart, localPos]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Car size={20} style={{ color: 'var(--color-understeel)' }} /> Analitik Kaki-Kaki (Understeel)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Menganalisis jenis kerusakan undercarriage, frekuensi perakitan, dan hubungannya dengan tipe mobil tertentu.
          </p>
        </div>

        {/* Local filters */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <select
            className="select-control"
            style={{ width: '160px', fontSize: '0.8125rem' }}
            value={localPart}
            onChange={e => setLocalPart(e.target.value)}
          >
            <option value="">-- Semua Part Understeel --</option>
            {masterData.understeel_part.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <select
            className="select-control"
            style={{ width: '130px', fontSize: '0.8125rem' }}
            value={localPos}
            onChange={e => setLocalPos(e.target.value)}
          >
            <option value="">-- Semua Posisi --</option>
            {masterData.part_position.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="empty-state" style={{ padding: '6rem 2rem' }}>
          <span className="empty-icon">⏳</span>
          <p>Menganalisis data kaki-kaki kendaraan...</p>
        </div>
      ) : error || !data ? (
        <div className="empty-state">
          <span className="empty-icon">⚠️</span>
          <p>Gagal memuat analitik understeel: {error || 'Terjadi kesalahan server.'}</p>
        </div>
      ) : (
        <>
          {/* Understeel KPIs */}
          <div className="scorecards-container">
            <div className="card card-accent-cyan">
              <span className="card-title">SUKU CADANG DIGANTI</span>
              <div className="card-value">
                {data.metrics.understeelQty} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>pcs</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Total kuantitas part terpasang</span>
            </div>

            <div className="card card-accent-green">
              <span className="card-title">OMSET BAGIAN UNDERSTEEL</span>
              <div className="card-value" style={{ color: 'var(--color-final)' }}>
                Rp {data.metrics.understeelRevenue.toLocaleString('id-ID')}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Setelah diskon dari final invoice</span>
            </div>
          </div>

          {/* Top Parts Split */}
          <div className="dashboard-grid">
            
            {/* Top Parts Qty */}
            <div className="card" style={{ padding: '1rem', gap: '0.75rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.9375rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                🔧 Part Terbanyak Diganti (Qty)
              </h3>
              {data.topPartsQty.length === 0 ? (
                <p style={{ fontStyle: 'italic', fontSize: '0.8125rem', color: 'var(--text-dark)', textAlign: 'center', padding: '1rem' }}>Tidak ada data understeel.</p>
              ) : (
                data.topPartsQty.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <span style={{ fontWeight: 500 }}>{idx + 1}. {item.item_name}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{item.qty} pcs</span>
                  </div>
                ))
              )}
            </div>

            {/* Top Parts Revenue */}
            <div className="card" style={{ padding: '1rem', gap: '0.75rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.9375rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                💰 Omset Part Tertinggi (Revenue)
              </h3>
              {data.topPartsRevenue.length === 0 ? (
                <p style={{ fontStyle: 'italic', fontSize: '0.8125rem', color: 'var(--text-dark)', textAlign: 'center', padding: '1rem' }}>Tidak ada data understeel.</p>
              ) : (
                data.topPartsRevenue.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <span style={{ fontWeight: 500 }}>{idx + 1}. {item.item_name}</span>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Rp {item.revenue.toLocaleString('id-ID')}</span>
                  </div>
                ))
              )}
            </div>

          </div>

          {/* Car Brand Matrix/Grid */}
          <div className="card" style={{ padding: '1.25rem', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Grid size={16} style={{ color: 'var(--primary)' }} />
                Matriks Hubungan Suku Cadang & Merek Mobil
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <Activity size={12} /> Menjawab part mana oblak di mobil apa
              </span>
            </div>

            {data.matrix.length === 0 ? (
              <p style={{ fontStyle: 'italic', fontSize: '0.8125rem', color: 'var(--text-dark)', textAlign: 'center', padding: '3rem' }}>Belum ada rekaman hubungan part dan model mobil.</p>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama Part Undercarriage</th>
                      <th>Merek & Series Mobil Pelanggan</th>
                      <th style={{ textAlign: 'center' }}>Jumlah Invoice Unik</th>
                      <th style={{ textAlign: 'right' }}>Kuantitas Diganti</th>
                      <th style={{ textAlign: 'right' }}>Total Omset (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.matrix.map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700 }}>{row.part_name}</td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem' }}>
                            🚗 {row.car_brand} {row.car_series}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>{row.invoice_count} x</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.qty} pcs</td>
                        <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 700 }}>{row.revenue.toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
}
