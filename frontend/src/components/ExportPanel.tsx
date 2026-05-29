import React, { useState } from 'react';
import { Download, ShieldCheck, FileSpreadsheet, FileText, AlertCircle, Info } from 'lucide-react';
import { GlobalFilters } from '../App.tsx';

interface ExportPanelProps {
  filters: GlobalFilters;
}

export default function ExportPanel({ filters }: ExportPanelProps) {
  const [exporting, setExporting] = useState<{ [key: string]: boolean }>({
    invoices: false,
    items: false,
    summary: false,
    template: false
  });

  // Import states
  const [file, setFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importingState, setImportingState] = useState<boolean>(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[] | null>(null);

  const getExportUrl = (type: 'invoices' | 'items' | 'summary' | 'template') => {
    if (type === 'template') return '/api/export/sample-template';
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    return `/api/export/${type}?${params.toString()}`;
  };

  const handleDownload = (type: 'invoices' | 'items' | 'summary' | 'template') => {
    setExporting(prev => ({ ...prev, [type]: true }));
    
    // Create hidden download trigger
    const link = document.createElement('a');
    link.href = getExportUrl(type);
    link.setAttribute('download', type === 'invoices' ? 'Invoices.csv' : type === 'items' ? 'InvoiceItems.csv' : type === 'summary' ? 'DashboardSummary.csv' : 'Template_Import_CRM.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // reset spinner
    setTimeout(() => {
      setExporting(prev => ({ ...prev, [type]: false }));
    }, 1500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setImportMessage(null);
      setImportErrors(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImportingState(true);
    setImportMessage(null);
    setImportErrors(null);

    try {
      const csvContent = await file.text();
      const res = await fetch('/api/invoices/import-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          csvContent,
          mode: importMode
        })
      });

      const json = await res.json();
      if (json.success) {
        setImportMessage(json.message);
        setFile(null);
        // Clear file input manually
        const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setImportErrors(json.errors || ['Terjadi kesalahan yang tidak diketahui.']);
      }
    } catch (err: any) {
      setImportErrors([err.message || 'Gagal membaca atau mengunggah berkas.']);
    } finally {
      setImportingState(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '850px', margin: '0 auto', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <span style={{ fontSize: '1.75rem' }}>💾</span>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem' }}>Backup, Ekspor & Impor</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Ekspor data transaksional, unduh template impor, atau unggah file CSV data untuk memuat data operasional secara instan ke CRM.
          </p>
        </div>
      </div>

      {/* active filters preview */}
      <div style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem', backgroundColor: 'hsl(222, 24%, 11%)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', alignItems: 'center', color: 'var(--text-muted)' }}>
        <Info size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <span>
          Periode Ekspor Aktif: <strong>{filters.startDate || 'Semua Waktu'}</strong> s.d <strong>{filters.endDate || 'Semua Waktu'}</strong>. Unduhan transaksional di bawah ini disesuaikan dengan rentang waktu tersebut.
        </span>
      </div>

      {/* Export Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        
        {/* Export Invoices Headers */}
        <div className="card" style={{ padding: '1.25rem', gap: '0.75rem', justifyContent: 'space-between', backgroundColor: 'hsl(222, 24%, 10%)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1.25rem' }}>📋</span>
              <strong style={{ fontSize: '0.9375rem' }}>Headers Invoice</strong>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Mengekspor data ringkasan invoice utama seperti nama pelanggan, detail mobil, sales person, status, catatan umum, dan total belanjaan.
            </p>
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', gap: '0.4rem', borderStyle: 'dashed' }}
            onClick={() => handleDownload('invoices')}
            disabled={exporting.invoices}
          >
            <Download size={14} /> {exporting.invoices ? 'Mengunduh...' : 'Unduh CSV (Invoices)'}
          </button>
        </div>

        {/* Export Invoice Items */}
        <div className="card" style={{ padding: '1.25rem', gap: '0.75rem', justifyContent: 'space-between', backgroundColor: 'hsl(222, 24%, 10%)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1.25rem' }}>📦</span>
              <strong style={{ fontSize: '0.9375rem' }}>Items Transaksi</strong>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Ekspor rinci per baris item belanjaan. Berisi ukuran & merek ban, tipe jasa kerja teknisi, posisi suku cadang kaki-kaki, kuantitas, harga, dan diskon.
            </p>
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', gap: '0.4rem', borderStyle: 'dashed' }}
            onClick={() => handleDownload('items')}
            disabled={exporting.items}
          >
            <Download size={14} /> {exporting.items ? 'Mengunduh...' : 'Unduh CSV (InvoiceItems)'}
          </button>
        </div>

        {/* Export Dashboard Summary */}
        <div className="card" style={{ padding: '1.25rem', gap: '0.75rem', justifyContent: 'space-between', backgroundColor: 'hsl(222, 24%, 10%)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1.25rem' }}>📈</span>
              <strong style={{ fontSize: '0.9375rem' }}>Ringkasan Periode</strong>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Mengekstrak data ringkasan KPI (omset total, ban luar terjual, volume jasa, kaki-kaki diganti, dsb) dalam periode terpilih ke dalam satu lembar.
            </p>
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', gap: '0.4rem', borderStyle: 'dashed' }}
            onClick={() => handleDownload('summary')}
            disabled={exporting.summary}
          >
            <Download size={14} /> {exporting.summary ? 'Mengunduh...' : 'Unduh CSV (Summary)'}
          </button>
        </div>

        {/* Import CSV Template */}
        <div className="card" style={{ padding: '1.25rem', gap: '0.75rem', justifyContent: 'space-between', backgroundColor: 'hsl(222, 24%, 10%)', border: '1px dashed var(--primary)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1.25rem' }}>📥</span>
              <strong style={{ fontSize: '0.9375rem', color: 'var(--primary)' }}>Template Impor CSV</strong>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Unduh berkas contoh template CSV lengkap dengan header kolom standar. Format ini dapat langsung Anda isi dan muat langsung ke database CRM.
            </p>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', gap: '0.4rem' }}
            onClick={() => handleDownload('template')}
            disabled={exporting.template}
          >
            <Download size={14} /> {exporting.template ? 'Mengunduh...' : 'Unduh Template Impor'}
          </button>
        </div>

      </div>

      {/* Upload & Import CSV Section */}
      <div className="card" style={{ padding: '1.25rem', gap: '1rem', border: '1px solid var(--border-subtle)', backgroundColor: 'hsl(222, 24%, 9%)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
          📥 Unggah & Impor File CSV Massal
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Pilih file CSV yang sudah Anda isi sesuai format template untuk mengimpor seluruh data transaksi dan menyegarkan autocomplete master data secara otomatis.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
          {/* File Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <input 
              id="csv-file-input"
              type="file" 
              accept=".csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button 
              className="btn btn-secondary"
              onClick={() => document.getElementById('csv-file-input')?.click()}
              style={{ borderStyle: 'solid', padding: '0.5rem 1rem' }}
            >
              📁 Pilih File CSV
            </button>
            <span style={{ fontSize: '0.8125rem', color: file ? 'var(--text-main)' : 'var(--text-dark)', fontWeight: file ? 600 : 400 }}>
              {file ? file.name : 'Belum ada file terpilih'}
            </span>
          </div>

          {/* Import Mode Selector */}
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>Mode Impor:</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input 
                type="radio" 
                name="importMode" 
                value="append" 
                checked={importMode === 'append'} 
                onChange={() => setImportMode('append')}
                style={{ accentColor: 'var(--primary)' }}
              />
              Tambahkan Data (Timpa jika No Faktur ganda)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--color-cancelled)' }}>
              <input 
                type="radio" 
                name="importMode" 
                value="replace" 
                checked={importMode === 'replace'} 
                onChange={() => setImportMode('replace')}
                style={{ accentColor: 'var(--color-cancelled)' }}
              />
              Reset Total (Hapus semua data lama & impor bersih)
            </label>
          </div>

          {/* Action Button */}
          <div>
            <button 
              className="btn btn-primary"
              onClick={handleImport}
              disabled={!file || importingState}
              style={{ width: '100%', maxWidth: '250px', justifyContent: 'center' }}
            >
              {importingState ? 'Memproses Impor...' : 'Mulai Proses Impor'}
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {importMessage && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', backgroundColor: 'hsla(145, 80%, 45%, 0.1)', border: '1px solid var(--color-final)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: 'var(--color-final)', fontWeight: 500 }}>
            ✅ {importMessage}
          </div>
        )}

        {importErrors && importErrors.length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', backgroundColor: 'hsla(350, 70%, 45%, 0.1)', border: '1px solid var(--color-cancelled)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: 'var(--color-cancelled)', fontWeight: 500 }}>
            ❌ Gagal Mengimpor:
            <ul style={{ margin: '0.35rem 0 0 1rem', padding: 0 }}>
              {importErrors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Safety Notice block */}
      <div style={{ padding: '1rem', backgroundColor: 'hsla(145, 80%, 45%, 0.08)', border: '1px solid hsla(145, 80%, 45%, 0.25)', borderRadius: 'var(--radius-md)', display: 'flex', gap: '0.75rem' }}>
        <ShieldCheck size={18} style={{ color: 'var(--color-final)', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h4 style={{ fontSize: '0.875rem', color: 'var(--color-final)', fontWeight: 700, marginBottom: '0.15rem' }}>Prosedur Impor Aman</h4>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Impor dilakukan secara transaksional penuh pada SQLite. Jika terjadi kegagalan format baris CSV, perubahan <strong>akan di-rollback secara otomatis</strong> sehingga database Anda tidak akan pernah tersimpan dalam kondisi rusak atau parsial.
          </p>
        </div>
      </div>

    </div>
  );
}
