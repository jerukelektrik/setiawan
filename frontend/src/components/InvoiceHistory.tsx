import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  User, 
  Tag, 
  ChevronLeft, 
  ChevronRight, 
  Edit, 
  Trash2, 
  Eye, 
  AlertCircle,
  FileText,
  Clock,
  Printer,
  X
} from 'lucide-react';
import { MasterData } from '../App.tsx';

interface InvoiceHistoryProps {
  masterData: MasterData;
  onEditInvoice: (id: number) => void;
}

interface Invoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  car_brand: string;
  car_series: string;
  car_year: number;
  notes: string;
  sales_person: string;
  status: 'Draft' | 'Final' | 'Cancelled';
  total_amount: number;
}

interface InvoiceDetail extends Invoice {
  items: {
    id: number;
    category: 'Barang' | 'Jasa' | 'Understeel';
    item_name: string;
    quantity: number;
    unit_price: number;
    discount: number;
    subtotal: number;
    sales_person: string;
    notes: string;
    goods_type: string;
    goods_brand: string;
    tire_brand: string;
    tire_size: string;
    tire_position: string;
    service_type: string;
    technician: string;
    part_brand: string;
    part_position: string;
  }[];
}

export default function InvoiceHistory({ masterData, onEditInvoice }: InvoiceHistoryProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [salesPerson, setSalesPerson] = useState<string>('');
  const [category, setCategory] = useState<string>('');

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 1
  });

  // Selected Detail Modal State
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Fetch Invoices List
  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (salesPerson) params.append('salesPerson', salesPerson);
    if (category) params.append('category', category);
    params.append('page', String(page));
    params.append('limit', String(limit));

    try {
      const res = await fetch(`/api/invoices?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setInvoices(json.invoices);
        setPagination(json.pagination);
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
    fetchInvoices();
  }, [page, search, status, startDate, endDate, salesPerson, category]);

  // Load Single Invoice Detail
  useEffect(() => {
    if (selectedInvoiceId) {
      setLoadingDetail(true);
      fetch(`/api/invoices/${selectedInvoiceId}`)
        .then(res => res.json())
        .then(json => {
          if (json.success) {
            setDetail(json.invoice);
          } else {
            alert(json.errors.join(', '));
            setSelectedInvoiceId(null);
          }
        })
        .catch(err => {
          alert('Gagal mengambil data detail: ' + err.message);
          setSelectedInvoiceId(null);
        })
        .finally(() => setLoadingDetail(false));
    } else {
      setDetail(null);
    }
  }, [selectedInvoiceId]);

  // Cancel Action
  const handleCancelInvoice = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin membatalkan invoice ini? Transaksi yang dibatalkan tidak akan dihitung dalam dashboard pendapatan.')) {
      return;
    }

    try {
      const res = await fetch(`/api/invoices/${id}/cancel`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        alert('Invoice berhasil dibatalkan.');
        if (selectedInvoiceId === id) {
          setSelectedInvoiceId(null);
        }
        fetchInvoices();
      } else {
        alert(json.errors.join(', '));
      }
    } catch (err: any) {
      alert('Gagal membatalkan invoice: ' + err.message);
    }
  };

  const getStatusBadge = (s: 'Draft' | 'Final' | 'Cancelled') => {
    switch (s) {
      case 'Draft': return <span className="badge badge-draft">Draft</span>;
      case 'Final': return <span className="badge badge-final">Final</span>;
      case 'Cancelled': return <span className="badge badge-cancelled">Cancelled</span>;
      default: return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Info */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', marginBottom: '0.25rem' }}>Riwayat Invoice & Operasional</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cari, saring, koreksi, dan batalkan invoice penjualan outlet bengkel.</p>
      </div>

      {/* Advanced Filters Panel */}
      <div className="card" style={{ padding: '1.25rem', gap: '1rem', backgroundColor: 'hsl(222, 24%, 11%)' }}>
        <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pencarian & Saringan Lanjutan</h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Search size={12} /> Cari Nomor/Pelanggan/Mobil</label>
            <input
              type="text"
              placeholder="e.g. INV-001, Budi, Avanza..."
              className="input-control"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={12} /> Status</label>
            <select
              className="select-control"
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
            >
              <option value="">-- Semua Status --</option>
              <option value="Draft">Draft</option>
              <option value="Final">Final</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><User size={12} /> Sales Person</label>
            <select
              className="select-control"
              value={salesPerson}
              onChange={e => { setSalesPerson(e.target.value); setPage(1); }}
            >
              <option value="">-- Semua Sales --</option>
              {masterData.sales.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Tag size={12} /> Kategori Item</label>
            <select
              className="select-control"
              value={category}
              onChange={e => { setCategory(e.target.value); setPage(1); }}
            >
              <option value="">-- Semua Kategori --</option>
              <option value="Barang">Barang</option>
              <option value="Jasa">Jasa</option>
              <option value="Understeel">Understeel</option>
            </select>
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={12} /> Tanggal</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="date"
                className="input-control"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setPage(1); }}
              />
              <span style={{ color: 'var(--text-dark)' }}>s.d</span>
              <input
                type="date"
                className="input-control"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setPage(1); }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Main Data Table */}
      {error && (
        <div style={{ padding: '1rem', backgroundColor: 'hsla(0, 85%, 60%, 0.1)', color: 'var(--color-cancelled)', border: '1px solid hsla(0,85%,60%,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
          Gagal memuat history invoice: {error}
        </div>
      )}

      {loading ? (
        <div className="empty-state" style={{ padding: '6rem 2rem' }}>
          <span className="empty-icon">⏳</span>
          <p>Memuat riwayat transaksi dari database...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📂</span>
          <p>Tidak ada invoice yang cocok dengan kriteria pencarian dan saringan Anda.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nomor Invoice</th>
                  <th>Nama Pelanggan</th>
                  <th>Mobil</th>
                  <th>Sales Utama</th>
                  <th>Total Transaksi</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td>{inv.invoice_date}</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{inv.invoice_number}</td>
                    <td style={{ fontWeight: 600 }}>{inv.customer_name}</td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      {inv.car_brand} {inv.car_series} ({inv.car_year})
                    </td>
                    <td>{inv.sales_person || <span style={{ color: 'var(--text-dark)', fontStyle: 'italic' }}>Tidak ada</span>}</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      Rp {inv.total_amount.toLocaleString('id-ID')}
                    </td>
                    <td>{getStatusBadge(inv.status)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.3rem', borderRadius: '4px' }}
                          title="Lihat Detail"
                          onClick={() => setSelectedInvoiceId(inv.id)}
                        >
                          <Eye size={13} />
                        </button>
                        
                        {/* Only allow editing on Draft or Active Final invoices */}
                        {inv.status !== 'Cancelled' && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.3rem', borderRadius: '4px' }}
                            title="Koreksi/Edit"
                            onClick={() => onEditInvoice(inv.id)}
                          >
                            <Edit size={13} />
                          </button>
                        )}

                        {inv.status !== 'Cancelled' && (
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.3rem', borderRadius: '4px' }}
                            title="Batalkan Invoice"
                            onClick={() => handleCancelInvoice(inv.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Menampilkan {invoices.length} dari {pagination.totalItems} transaksi
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.3rem 0.6rem' }}
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                Halaman {pagination.page} / {pagination.totalPages}
              </span>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.3rem 0.6rem' }}
                disabled={page === pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal Overlay */}
      {selectedInvoiceId && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
          onClick={() => setSelectedInvoiceId(null)}
        >
          <div 
            className="card" 
            style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-subtle)', cursor: 'default' }}
            onClick={e => e.stopPropagation()}
          >
            {loadingDetail ? (
              <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                ⏳ Membuka detail transaksi...
              </div>
            ) : detail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>🧾</span>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem' }}>
                        Detail Invoice {detail.invoice_number}
                      </h3>
                      {getStatusBadge(detail.status)}
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>ID Transaksi: {detail.id} | Dibuat: {detail.invoice_date}</p>
                  </div>
                  <button className="btn btn-secondary" style={{ padding: '0.35rem' }} onClick={() => setSelectedInvoiceId(null)}>
                    <X size={16} />
                  </button>
                </div>

                {/* Modal Info Grids */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', backgroundColor: 'hsl(222, 24%, 10%)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Pelanggan</span>
                    <strong style={{ fontSize: '0.9375rem' }}>{detail.customer_name}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Profil Kendaraan</span>
                    <strong style={{ fontSize: '0.9375rem' }}>{detail.car_brand} {detail.car_series} ({detail.car_year})</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Sales Utama</span>
                    <strong style={{ fontSize: '0.9375rem' }}>{detail.sales_person || '-'}</strong>
                  </div>
                  <div style={{ gridColumn: 'span 3' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>Catatan</span>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontStyle: detail.notes ? 'normal' : 'italic' }}>
                      {detail.notes || 'Tidak ada catatan khusus.'}
                    </p>
                  </div>
                </div>

                {/* Modal Items List */}
                <div>
                  <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', marginBottom: '0.75rem' }}>Rincian Pembelian & Layanan</h4>
                  
                  <div className="table-container" style={{ border: '1px solid var(--border-subtle)' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Kategori</th>
                          <th>Nama Item / Jasa / Part</th>
                          <th>Keterangan Tambahan</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>Harga Satuan</th>
                          <th style={{ textAlign: 'right' }}>Diskon</th>
                          <th style={{ textAlign: 'right' }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.map(item => (
                          <tr key={item.id}>
                            <td>
                              <span className={`cat-badge cat-${item.category.toLowerCase()}`}>{item.category}</span>
                            </td>
                            <td>
                              <strong style={{ fontSize: '0.875rem' }}>{item.item_name}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {item.sales_person && `Sales: ${item.sales_person}`}
                                {item.technician && ` | Teknisi: ${item.technician}`}
                              </div>
                            </td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {item.category === 'Barang' && (
                                <>
                                  Jenis: {item.goods_type}
                                  {item.tire_position && ` | Posisi: ${item.tire_position}`}
                                </>
                              )}
                              {item.category === 'Understeel' && (
                                <>
                                  Posisi: {item.part_position}
                                  {item.part_brand && ` | Merek: ${item.part_brand}`}
                                </>
                              )}
                              {item.notes && ` | Catatan: ${item.notes}`}
                            </td>
                            <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right' }}>Rp {item.unit_price.toLocaleString('id-ID')}</td>
                            <td style={{ textAlign: 'right', color: 'var(--color-cancelled)' }}>-Rp {item.discount.toLocaleString('id-ID')}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                              Rp {item.subtotal.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Modal Footer (Total + Aksi) */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL AKHIR</span>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.75rem', color: 'var(--primary)', lineHeight: 1 }}>
                      Rp {detail.total_amount.toLocaleString('id-ID')}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => {
                        window.print();
                      }}
                    >
                      <Printer size={14} /> Cetak Struk
                    </button>
                    {detail.status !== 'Cancelled' && (
                      <button 
                        type="button" 
                        className="btn btn-danger"
                        onClick={() => handleCancelInvoice(detail.id)}
                      >
                        <Trash2 size={14} /> Batalkan Invoice
                      </button>
                    )}
                    {detail.status !== 'Cancelled' && (
                      <button 
                        type="button" 
                        className="btn btn-primary"
                        onClick={() => {
                          setSelectedInvoiceId(null);
                          onEditInvoice(detail.id);
                        }}
                      >
                        <Edit size={14} /> Koreksi Invoice
                      </button>
                    )}
                  </div>
                </div>

              </div>
            ) : null}
          </div>
        </div>
      )}

    </div>
  );
}
