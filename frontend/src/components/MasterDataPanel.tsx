import React, { useState } from 'react';
import { Settings, Plus, RotateCcw, Award } from 'lucide-react';
import { MasterData } from '../App.tsx';

interface MasterDataPanelProps {
  masterData: MasterData;
  onRefresh: () => void;
}

export default function MasterDataPanel({ masterData, onRefresh }: MasterDataPanelProps) {
  const [selectedCat, setSelectedCat] = useState<keyof MasterData>('sales');
  const [newValue, setNewValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const getCategoryLabel = (cat: keyof MasterData) => {
    switch (cat) {
      case 'sales': return 'Sales Person';
      case 'car_brand': return 'Merek Mobil';
      case 'car_series': return 'Series Mobil';
      case 'service_type': return 'Tipe Layanan Jasa';
      case 'goods_type': return 'Jenis Barang';
      case 'tire_brand': return 'Merek Ban';
      case 'tire_size': return 'Ukuran Ban';
      case 'understeel_part': return 'Part Kaki-Kaki';
      case 'part_position': return 'Posisi Part Pasang';
      default: return cat;
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/master-data/${selectedCat}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue })
      });
      const json = await res.json();
      if (json.success) {
        setNewValue('');
        setMessage('Master data berhasil didaftarkan.');
        onRefresh();
      } else {
        setError(json.errors.join(', '));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '900px', margin: '0 auto', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={20} style={{ color: 'var(--text-muted)' }} /> Manajemen Master Data
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Menyediakan daftar autocomplete terstandar untuk mempercepat pencatatan invoice dan menjaga kualitas kebersihan data analitik.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={onRefresh}>
          <RotateCcw size={14} /> Sinkronisasi
        </button>
      </div>

      {/* Main Split Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        
        {/* Left Side: Select Categories List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Daftar Kategori</h4>
          {Object.keys(masterData).map(catKey => {
            const key = catKey as keyof MasterData;
            return (
              <button
                key={key}
                type="button"
                className={`nav-item ${selectedCat === key ? 'active' : ''}`}
                style={{ justifyContent: 'flex-start', padding: '0.6rem 0.85rem', width: '100%' }}
                onClick={() => { setSelectedCat(key); setError(null); setMessage(null); }}
              >
                ⚙️ {getCategoryLabel(key)}
              </button>
            );
          })}
        </div>

        {/* Right Side: Values List and Inserter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Inserter Form */}
          <div style={{ padding: '1rem', backgroundColor: 'hsl(222, 24%, 11%)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.75rem' }}>
              Registrasi Opsi Baru untuk {getCategoryLabel(selectedCat)}
            </h4>
            
            <form onSubmit={handleRegister} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Nama/Nilai Opsi</label>
                <input
                  type="text"
                  placeholder={`e.g. ${selectedCat === 'car_brand' ? 'Toyota' : 'Nilai Baru'}`}
                  className="input-control"
                  required
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ height: '38px' }} disabled={loading}>
                <Plus size={16} /> {loading ? 'Menambahkan...' : 'Daftarkan'}
              </button>
            </form>

            {message && <div style={{ color: 'var(--color-final)', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.5rem' }}>✓ {message}</div>}
            {error && <div style={{ color: 'var(--color-cancelled)', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.5rem' }}>✗ {error}</div>}
          </div>

          {/* Preset Values List Box */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
              Opsi Terdaftar saat ini ({masterData[selectedCat]?.length || 0})
            </h4>

            {(!masterData[selectedCat] || masterData[selectedCat].length === 0) ? (
              <p style={{ fontStyle: 'italic', fontSize: '0.8125rem', color: 'var(--text-dark)' }}>Belum ada opsi terdaftar.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {masterData[selectedCat].map(val => (
                  <span 
                    key={val} 
                    style={{ fontSize: '0.8125rem', backgroundColor: 'hsl(222, 24%, 8%)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '0.25rem 0.55rem', color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center' }}
                  >
                    {val}
                  </span>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
