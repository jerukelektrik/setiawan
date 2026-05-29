import React, { useState, useEffect } from 'react';
import { Wrench, Award, BarChart3, HelpCircle, Activity, Sparkles } from 'lucide-react';
import { GlobalFilters } from '../App.tsx';

interface ServiceAnalyticsProps {
  filters: GlobalFilters;
}

interface ServiceData {
  volume: {
    topServices: { service_name: string; qty: number; revenue: number }[];
    trends: { date: string; qty: number; revenue: number }[];
  };
  attachRate: {
    tireCount: number;
    understeelCount: number;
    tireAttachments: { serviceName: string; attachedCount: number; baseCount: number; rate: number }[];
    understeelAttachments: { serviceName: string; attachedCount: number; baseCount: number; rate: number }[];
  };
}

export default function ServiceAnalytics({ filters }: ServiceAnalyticsProps) {
  const [data, setData] = useState<ServiceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServiceAnalytics = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.salesPerson) params.append('salesPerson', filters.salesPerson);

    try {
      const res = await fetch(`/api/analytics/services?${params.toString()}`);
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
    fetchServiceAnalytics();
  }, [filters]);

  const renderProgressBar = (rate: number, color: string) => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
        <div className="score-track" style={{ height: '6px', flex: 1, backgroundColor: 'hsl(222, 24%, 8%)' }}>
          <div className="score-bar" style={{ width: `${rate}%`, background: color }} />
        </div>
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, width: '45px', textAlign: 'right', color }}>
          {rate.toFixed(1)}%
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Wrench size={20} style={{ color: 'var(--color-jasa)' }} /> Analitik Pekerjaan Jasa & Attach Rate
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Menganalisis volume pengerjaan jasa, tren transaksi, dan tingkat keikutsertaan jasa (attach rate) terhadap pembelian ban atau part kaki-kaki.
        </p>
      </div>

      {loading ? (
        <div className="empty-state" style={{ padding: '6rem 2rem' }}>
          <span className="empty-icon">⏳</span>
          <p>Menganalisis volume jasa dan menghitung tingkat attach rate...</p>
        </div>
      ) : error || !data ? (
        <div className="empty-state">
          <span className="empty-icon">⚠️</span>
          <p>Gagal memuat analitik jasa: {error || 'Terjadi kesalahan server.'}</p>
        </div>
      ) : (
        <>
          {/* Main Dashboard Section Split */}
          <div className="dashboard-grid">
            
            {/* 1. VOLUME JASA SECTION */}
            <div className="card" style={{ padding: '1.25rem', gap: '0.75rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.05rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart3 size={16} style={{ color: 'var(--color-jasa)' }} />
                Volume & Omset Pekerjaan Jasa
              </h3>
              
              {data.volume.topServices.length === 0 ? (
                <p style={{ fontStyle: 'italic', fontSize: '0.8125rem', color: 'var(--text-dark)', textAlign: 'center', padding: '2rem' }}>Tidak ada data jasa.</p>
              ) : (
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tipe Jasa</th>
                        <th style={{ textAlign: 'center' }}>Total Dikerjakan</th>
                        <th style={{ textAlign: 'right' }}>Total Omset (Rp)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.volume.topServices.map((row, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{row.service_name}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>{row.qty} kali</td>
                          <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 700 }}>
                            {row.revenue.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. EXPLANATION AND BASE METRICS */}
            <div className="card" style={{ padding: '1.25rem', gap: '1rem', backgroundColor: 'hsl(222, 24%, 11%)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={16} style={{ color: 'var(--color-draft)' }} />
                Apa itu Attach Rate Jasa?
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Attach Rate mengukur seberapa sering sebuah layanan jasa (misalnya <em>Spooring</em> atau <em>Balancing</em>) ikut dibeli ketika pelanggan membeli Ban atau melakukan servis kaki-kaki (Understeel).
              </p>
              <div style={{ fontSize: '0.75rem', padding: '0.75rem', backgroundColor: 'hsl(222, 24%, 8%)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <strong>Rumus Attach Rate Ban:</strong>
                <code style={{ color: 'var(--primary)' }}>Invoice berisi (Ban + Jasa Terkait) / Total Invoice berisi Ban</code>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <div style={{ flex: 1, padding: '0.75rem', backgroundColor: 'hsla(200, 95%, 50%, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid hsla(200, 95%, 50%, 0.15)' }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>INVOICE BAN (BASE)</span>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--color-barang)' }}>{data.attachRate.tireCount} trx</strong>
                </div>
                <div style={{ flex: 1, padding: '0.75rem', backgroundColor: 'hsla(175, 75%, 45%, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid hsla(175, 75%, 45%, 0.15)' }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>INVOICE UNDERSTEEL (BASE)</span>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--color-understeel)' }}>{data.attachRate.understeelCount} trx</strong>
                </div>
              </div>
            </div>

          </div>

          {/* 3. ATTACH RATE TABLES */}
          <div className="dashboard-grid">
            
            {/* Attach Rate terhadap Ban */}
            <div className="card" style={{ padding: '1.25rem', gap: '0.75rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={16} style={{ color: 'var(--color-barang)' }} />
                Attach Rate Jasa terhadap Pembelian Ban
              </h3>
              
              {data.attachRate.tireAttachments.length === 0 ? (
                <p style={{ fontStyle: 'italic', fontSize: '0.8125rem', color: 'var(--text-dark)', textAlign: 'center', padding: '2rem' }}>Tidak ada data jasa.</p>
              ) : (
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                    <thead>
                      <tr>
                        <th>Tipe Jasa</th>
                        <th style={{ textAlign: 'center' }}>Terlampir</th>
                        <th>Rasio Keikutsertaan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.attachRate.tireAttachments.map((row, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{row.serviceName}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                            {row.attachedCount} / {row.baseCount}
                          </td>
                          <td>
                            {renderProgressBar(row.rate, 'var(--color-barang)')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Attach Rate terhadap Understeel */}
            <div className="card" style={{ padding: '1.25rem', gap: '0.75rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={16} style={{ color: 'var(--color-understeel)' }} />
                Attach Rate Jasa terhadap Servis Understeel
              </h3>
              
              {data.attachRate.understeelAttachments.length === 0 ? (
                <p style={{ fontStyle: 'italic', fontSize: '0.8125rem', color: 'var(--text-dark)', textAlign: 'center', padding: '2rem' }}>Tidak ada data jasa.</p>
              ) : (
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                    <thead>
                      <tr>
                        <th>Tipe Jasa</th>
                        <th style={{ textAlign: 'center' }}>Terlampir</th>
                        <th>Rasio Keikutsertaan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.attachRate.understeelAttachments.map((row, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{row.serviceName}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                            {row.attachedCount} / {row.baseCount}
                          </td>
                          <td>
                            {renderProgressBar(row.rate, 'var(--color-understeel)')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </>
      )}

    </div>
  );
}
