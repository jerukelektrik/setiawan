import React, { useState, useEffect } from 'react';
import { Trophy, Award, Landmark, TrendingUp, AlertTriangle } from 'lucide-react';
import { GlobalFilters } from '../App.tsx';

interface SalesLeaderboardProps {
  filters: GlobalFilters;
}

interface SalesLeaderboardEntry {
  salesPerson: string;
  totalRevenue: number;
  invoiceCount: number;
  avgInvoiceValue: number;
  revenueSplit: { Barang: number; Jasa: number; Understeel: number };
  tireQtySold: number;
  revenueIndex: number;
  invoiceIndex: number;
  salesScore: number;
}

export default function SalesLeaderboard({ filters }: SalesLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<SalesLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    try {
      const res = await fetch(`/api/analytics/leaderboard?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLeaderboard(json.data);
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
    fetchLeaderboard();
  }, [filters]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trophy size={20} style={{ color: 'var(--color-draft)' }} /> Leaderboard Sales Person
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Peringkat performa sales berdasarkan gabungan indeks kontribusi pendapatan (bobot 60%) dan indeks frekuensi transaksi (bobot 40%).
        </p>
      </div>

      {loading ? (
        <div className="empty-state" style={{ padding: '6rem 2rem' }}>
          <span className="empty-icon">⏳</span>
          <p>Menganalisis performa tim sales...</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <span className="empty-icon">⚠️</span>
          <p>Gagal memuat leaderboard sales: {error}</p>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🎖️</span>
          <p>Belum ada data transaksi final untuk sales di periode ini.</p>
        </div>
      ) : (
        <>
          {/* Top 3 Visual Podiums */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
            {leaderboard.slice(0, 3).map((entry, idx) => {
              let medal = '🥇';
              let badgeColor = 'var(--color-draft)';
              if (idx === 1) { medal = '🥈'; badgeColor = 'var(--text-muted)'; }
              if (idx === 2) { medal = '🥉'; badgeColor = 'var(--color-understeel)'; }

              return (
                <div 
                  key={entry.salesPerson} 
                  className="card" 
                  style={{ flex: '1 1 250px', maxWidth: '320px', padding: '1.5rem', alignItems: 'center', borderTop: `4px solid ${badgeColor}`, position: 'relative' }}
                >
                  <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{medal}</span>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', textAlign: 'center', marginBottom: '0.25rem' }}>
                    {entry.salesPerson}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                    Sales Score: <strong>{(entry.salesScore * 100).toFixed(1)}</strong>
                  </div>
                  
                  <div style={{ width: '100%', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-around', fontSize: '0.8125rem', textAlign: 'center' }}>
                    <div>
                      <span style={{ color: 'var(--text-dark)', display: 'block', fontSize: '0.6875rem' }}>REVENUE</span>
                      <strong>Rp {Math.round(entry.totalRevenue/1000).toLocaleString('id-ID')}k</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dark)', display: 'block', fontSize: '0.6875rem' }}>INVOICES</span>
                      <strong>{entry.invoiceCount} trx</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Progress List & Scores */}
          <div className="card" style={{ padding: '1.25rem', gap: '1.25rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={16} style={{ color: 'var(--primary)' }} />
              Skor Performa Gabungan (Sales Score)
            </h3>
            
            <div>
              {leaderboard.map((entry, index) => (
                <div key={entry.salesPerson} className="score-row">
                  <div className="score-info">
                    <span className="score-name">{index + 1}. {entry.salesPerson}</span>
                    <span className="score-val">
                      Skor: {(entry.salesScore * 100).toFixed(1)} pts
                    </span>
                  </div>
                  <div className="score-track">
                    <div className="score-bar" style={{ width: `${entry.salesScore * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leaderboard Table with Splits */}
          <div className="card" style={{ padding: '1.25rem', gap: '0.75rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Landmark size={16} style={{ color: 'var(--color-understeel)' }} />
              Statistik Kontribusi Rinci per Sales
            </h3>
            
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sales</th>
                    <th style={{ textAlign: 'right' }}>Total Omset (Rp)</th>
                    <th style={{ textAlign: 'center' }}>Jumlah Invoice</th>
                    <th style={{ textAlign: 'right' }}>Rata-rata Basket</th>
                    <th style={{ textAlign: 'right' }}>Omset Barang (Ban/Oli)</th>
                    <th style={{ textAlign: 'right' }}>Omset Jasa</th>
                    <th style={{ textAlign: 'right' }}>Omset Understeel</th>
                    <th style={{ textAlign: 'center' }}>Ban Terjual</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map(entry => (
                    <tr key={entry.salesPerson}>
                      <td><strong>{entry.salesPerson}</strong></td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-final)' }}>
                        {entry.totalRevenue.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                        {entry.invoiceCount} trx
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {Math.round(entry.avgInvoiceValue).toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.8125rem' }}>
                        {entry.revenueSplit.Barang.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.8125rem' }}>
                        {entry.revenueSplit.Jasa.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.8125rem' }}>
                        {entry.revenueSplit.Understeel.toLocaleString('id-ID')}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>
                        {entry.tireQtySold} pcs
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
