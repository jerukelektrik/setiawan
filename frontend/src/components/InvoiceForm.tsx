import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash, Save, X, AlertCircle } from 'lucide-react';
import { MasterData } from '../App.tsx';

interface InvoiceFormProps {
  invoiceId: number | null;
  masterData: MasterData;
  onSaved: () => void;
  onCancel: () => void;
}

interface FormItem {
  id: string; // client-side temp UUID/key
  category: 'Barang' | 'Jasa' | 'Understeel';
  item_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  sales_person: string;
  notes: string;

  // Barang fields
  goods_type: 'Ban' | 'Oli' | 'Chemical' | 'Lainnya';
  goods_brand: string;
  
  // Ban fields
  tire_brand: string;
  tire_size: string;
  tire_pattern: string;
  tire_position: string;

  // Jasa fields
  service_type: string;
  technician: string;

  // Understeel fields
  part_brand: string;
  part_position: string;
}

export default function InvoiceForm({ invoiceId, masterData, onSaved, onCancel }: InvoiceFormProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Header State
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState<string>('');
  const [carBrand, setCarBrand] = useState<string>('');
  const [carSeries, setCarSeries] = useState<string>('');
  const [carYear, setCarYear] = useState<string>('');
  const [headerSalesPerson, setHeaderSalesPerson] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<'Draft' | 'Final'>('Draft');

  // Items State
  const [items, setItems] = useState<FormItem[]>([]);

  // Autocomplete helpers
  const [focusedInput, setFocusedInput] = useState<{ type: string; index?: number } | null>(null);

  // Load existing invoice if editing
  useEffect(() => {
    if (invoiceId) {
      setLoading(true);
      fetch(`/api/invoices/${invoiceId}`)
        .then(res => res.json())
        .then(json => {
          if (json.success) {
            const inv = json.invoice;
            setInvoiceNumber(inv.invoice_number);
            setInvoiceDate(inv.invoice_date);
            setCustomerName(inv.customer_name);
            setCarBrand(inv.car_brand);
            setCarSeries(inv.car_series);
            setCarYear(String(inv.car_year));
            setHeaderSalesPerson(inv.sales_person || '');
            setNotes(inv.notes || '');
            setStatus(inv.status === 'Cancelled' ? 'Draft' : inv.status); // draft by default if cancelled is resurrected

            const mappedItems = inv.items.map((item: any) => ({
              id: String(Math.random()),
              category: item.category,
              item_name: item.item_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount: item.discount,
              sales_person: item.sales_person || '',
              notes: item.notes || '',
              goods_type: item.goods_type || 'Lainnya',
              goods_brand: item.goods_brand || '',
              tire_brand: item.tire_brand || '',
              tire_size: item.tire_size || '',
              tire_pattern: item.tire_pattern || '',
              tire_position: item.tire_position || '',
              service_type: item.service_type || '',
              technician: item.technician || '',
              part_brand: item.part_brand || '',
              part_position: item.part_position || ''
            }));
            setItems(mappedItems);
          } else {
            setErrors(json.errors);
          }
        })
        .catch(err => setErrors([err.message]))
        .finally(() => setLoading(false));
    } else {
      // Auto-generate invoice number if new
      const rand = Math.floor(1000 + Math.random() * 9000);
      const today = new Date();
      const yr = today.getFullYear();
      const mo = String(today.getMonth() + 1).padStart(2, '0');
      const dy = String(today.getDate()).padStart(2, '0');
      setInvoiceNumber(`INV-${yr}${mo}${dy}-${rand}`);
      
      // Default with one empty item
      addItem();
    }
  }, [invoiceId]);

  const addItem = () => {
    const newItem: FormItem = {
      id: String(Math.random()),
      category: 'Barang',
      item_name: '',
      quantity: 1,
      unit_price: 0,
      discount: 0,
      sales_person: '',
      notes: '',
      goods_type: 'Ban',
      goods_brand: '',
      tire_brand: '',
      tire_size: '',
      tire_pattern: '',
      tire_position: '',
      service_type: '',
      technician: '',
      part_brand: '',
      part_position: ''
    };
    setItems(prev => [...prev, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(x => x.id !== id));
  };

  const updateItem = (id: string, key: keyof FormItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [key]: value };

      // Autocomplete helper names
      if (key === 'category') {
        // Reset category specific defaults
        if (value === 'Barang') {
          updated.goods_type = 'Ban';
          updated.tire_position = 'Depan';
        } else if (value === 'Jasa') {
          updated.service_type = '';
        } else if (value === 'Understeel') {
          updated.part_position = 'Depan';
        }
      }

      // Synchronize item_name with specific category selection
      if (updated.category === 'Barang') {
        if (updated.goods_type === 'Ban') {
          updated.item_name = `Ban ${updated.tire_brand} ${updated.tire_size} ${updated.tire_pattern}`.trim();
        } else {
          updated.item_name = `${updated.goods_type} ${updated.goods_brand}`.trim();
        }
      } else if (updated.category === 'Jasa') {
        updated.item_name = updated.service_type;
      }

      return updated;
    }));
  };

  // Math totals
  const getItemSubtotal = (item: FormItem) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const disc = Number(item.discount || 0);
    return Math.max(0, qty * price - disc);
  };

  const getInvoiceTotal = () => {
    return items.reduce((acc, item) => acc + getItemSubtotal(item), 0);
  };

  // Save submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setLoading(true);

    const invoicePayload = {
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      customer_name: customerName,
      car_brand: carBrand,
      car_series: carSeries,
      car_year: Number(carYear),
      notes,
      sales_person: headerSalesPerson,
      status,
      items: items.map(item => ({
        category: item.category,
        item_name: item.item_name || 'Item Tanpa Nama',
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        discount: Number(item.discount),
        sales_person: item.sales_person || null,
        notes: item.notes || null,
        goods_type: item.category === 'Barang' ? item.goods_type : null,
        goods_brand: item.category === 'Barang' ? item.goods_brand : null,
        tire_brand: item.category === 'Barang' && item.goods_type === 'Ban' ? item.tire_brand : null,
        tire_size: item.category === 'Barang' && item.goods_type === 'Ban' ? item.tire_size : null,
        tire_pattern: item.category === 'Barang' && item.goods_type === 'Ban' ? item.tire_pattern : null,
        tire_position: item.category === 'Barang' && item.goods_type === 'Ban' ? item.tire_position : null,
        service_type: item.category === 'Jasa' ? item.service_type : null,
        technician: (item.category === 'Jasa' || item.category === 'Understeel') ? item.technician : null,
        part_brand: item.category === 'Understeel' ? item.part_brand : null,
        part_position: item.category === 'Understeel' ? item.part_position : null
      }))
    };

    try {
      const url = invoiceId ? `/api/invoices/${invoiceId}` : '/api/invoices';
      const method = invoiceId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoicePayload)
      });
      const json = await res.json();
      if (json.success) {
        onSaved();
      } else {
        setErrors(json.errors || ['Gagal menyimpan invoice.']);
      }
    } catch (err: any) {
      setErrors([err.message]);
    } finally {
      setLoading(false);
    }
  };

  // Close dropdown helper
  useEffect(() => {
    const handleOutsideClick = () => {
      setFocusedInput(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  return (
    <div className="card" style={{ maxWidth: '1200px', margin: '0 auto', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem' }}>
            {invoiceId ? `Koreksi Invoice #${invoiceNumber}` : 'Buat Invoice Baru'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Mencatat transaksi multi-kategori Barang, Jasa, dan Understeel untuk outlet.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={onCancel}>
          <X size={16} /> Batal
        </button>
      </div>

      {errors.length > 0 && (
        <div style={{ backgroundColor: 'hsla(0, 85%, 60%, 0.1)', border: '1px solid var(--color-cancelled)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <AlertCircle size={18} style={{ color: 'var(--color-cancelled)', marginTop: '2px', flexShrink: 0 }} />
          <div>
            <h4 style={{ color: 'var(--color-cancelled)', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.25rem' }}>Kesalahan Validasi:</h4>
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--text-main)' }}>
              {errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Header Fields Section */}
        <div className="form-grid" style={{ backgroundColor: 'hsl(222, 24%, 11%)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div className="form-group">
            <label>Nomor Invoice</label>
            <input 
              type="text" 
              className="input-control" 
              placeholder="e.g. INV-20260528-001" 
              required
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Tanggal Invoice</label>
            <input 
              type="date" 
              className="input-control" 
              required
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
            />
          </div>

          <div className="form-group" onClick={e => e.stopPropagation()}>
            <label>Nama Pelanggan</label>
            <input 
              type="text" 
              className="input-control" 
              placeholder="e.g. Budi Santoso" 
              required
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
          </div>

          <div className="form-group" onClick={e => e.stopPropagation()}>
            <label>Merek Mobil</label>
            <input 
              type="text" 
              className="input-control" 
              placeholder="e.g. Toyota" 
              required
              value={carBrand}
              onChange={e => {
                setCarBrand(e.target.value);
                setFocusedInput({ type: 'carBrand' });
              }}
              onFocus={() => setFocusedInput({ type: 'carBrand' })}
            />
            {focusedInput?.type === 'carBrand' && (
              <div className="suggestions-dropdown">
                {masterData.car_brand
                  .filter(b => b.toLowerCase().includes(carBrand.toLowerCase()))
                  .map(b => (
                    <div 
                      key={b} 
                      className="suggestion-item"
                      onClick={() => {
                        setCarBrand(b);
                        setFocusedInput(null);
                      }}
                    >
                      {b}
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="form-group" onClick={e => e.stopPropagation()}>
            <label>Series Mobil</label>
            <input 
              type="text" 
              className="input-control" 
              placeholder="e.g. Avanza" 
              required
              value={carSeries}
              onChange={e => {
                setCarSeries(e.target.value);
                setFocusedInput({ type: 'carSeries' });
              }}
              onFocus={() => setFocusedInput({ type: 'carSeries' })}
            />
            {focusedInput?.type === 'carSeries' && (
              <div className="suggestions-dropdown">
                {masterData.car_series
                  .filter(s => s.toLowerCase().includes(carSeries.toLowerCase()))
                  .map(s => (
                    <div 
                      key={s} 
                      className="suggestion-item"
                      onClick={() => {
                        setCarSeries(s);
                        setFocusedInput(null);
                      }}
                    >
                      {s}
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Tahun Mobil</label>
            <input 
              type="number" 
              className="input-control" 
              placeholder="e.g. 2018" 
              required
              value={carYear}
              onChange={e => setCarYear(e.target.value)}
            />
          </div>

          <div className="form-group" onClick={e => e.stopPropagation()}>
            <label>Sales Utama Invoice</label>
            <input 
              type="text" 
              className="input-control" 
              placeholder="e.g. Andi" 
              value={headerSalesPerson}
              onChange={e => {
                setHeaderSalesPerson(e.target.value);
                setFocusedInput({ type: 'sales' });
              }}
              onFocus={() => setFocusedInput({ type: 'sales' })}
            />
            {focusedInput?.type === 'sales' && (
              <div className="suggestions-dropdown">
                {masterData.sales
                  .filter(s => s.toLowerCase().includes(headerSalesPerson.toLowerCase()))
                  .map(s => (
                    <div 
                      key={s} 
                      className="suggestion-item"
                      onClick={() => {
                        setHeaderSalesPerson(s);
                        setFocusedInput(null);
                      }}
                    >
                      {s}
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label>Catatan Umum</label>
            <input 
              type="text" 
              className="input-control" 
              placeholder="Tambahkan catatan khusus transaksi disini..." 
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Invoice Multi-Item Entry Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.15rem' }}>Detail Item Transaksi</h3>
            <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem' }} onClick={addItem}>
              <Plus size={14} /> Tambah Baris Item
            </button>
          </div>

          {items.length === 0 ? (
            <div className="empty-state" style={{ padding: '2.5rem 1rem' }}>
              <span className="empty-icon">📦</span>
              <p>Belum ada item di dalam invoice ini. Klik tombol tambah diatas untuk menyusun item.</p>
            </div>
          ) : (
            items.map((item, idx) => (
              <div key={item.id} className="item-editor-row" onClick={e => e.stopPropagation()}>
                <div className="item-editor-header">
                  <div className="item-editor-title">
                    <span style={{ color: 'var(--text-dark)' }}>#{idx + 1}</span>
                    <span className={`cat-badge cat-${item.category.toLowerCase()}`}>{item.category}</span>
                    <span>
                      {item.item_name || <span style={{ color: 'var(--text-dark)', fontStyle: 'italic' }}>Nama item kosong</span>}
                    </span>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-danger" 
                    style={{ padding: '0.2rem', borderColor: 'transparent' }}
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash size={14} />
                  </button>
                </div>

                <div className="form-grid">
                  {/* Category Selection */}
                  <div className="form-group">
                    <label>Kategori Item</label>
                    <select
                      className="select-control"
                      value={item.category}
                      onChange={e => updateItem(item.id, 'category', e.target.value)}
                    >
                      <option value="Barang">Barang (Oli, Ban, dll)</option>
                      <option value="Jasa">Jasa (Spooring, dll)</option>
                      <option value="Understeel">Understeel (Suspensi)</option>
                    </select>
                  </div>

                  {/* Category-Specific Form Fields */}
                  {item.category === 'Barang' && (
                    <>
                      <div className="form-group">
                        <label>Jenis Barang</label>
                        <select
                          className="select-control"
                          value={item.goods_type}
                          onChange={e => updateItem(item.id, 'goods_type', e.target.value)}
                        >
                          <option value="Ban">Ban</option>
                          <option value="Oli">Oli</option>
                          <option value="Chemical">Chemical</option>
                          <option value="Lainnya">Lainnya</option>
                        </select>
                      </div>

                      {item.goods_type === 'Ban' ? (
                        <>
                          <div className="form-group">
                            <label>Merek Ban</label>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="e.g. Bridgestone"
                              value={item.tire_brand}
                              onChange={e => {
                                updateItem(item.id, 'tire_brand', e.target.value);
                                setFocusedInput({ type: 'tire_brand', index: idx });
                              }}
                              onFocus={() => setFocusedInput({ type: 'tire_brand', index: idx })}
                            />
                            {focusedInput?.type === 'tire_brand' && focusedInput?.index === idx && (
                              <div className="suggestions-dropdown">
                                {masterData.tire_brand
                                  .filter(b => b.toLowerCase().includes(item.tire_brand.toLowerCase()))
                                  .map(b => (
                                    <div 
                                      key={b} 
                                      className="suggestion-item"
                                      onClick={() => {
                                        updateItem(item.id, 'tire_brand', b);
                                        setFocusedInput(null);
                                      }}
                                    >
                                      {b}
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>

                          <div className="form-group">
                            <label>Ukuran Ban</label>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="e.g. 185/70 R14"
                              value={item.tire_size}
                              onChange={e => {
                                updateItem(item.id, 'tire_size', e.target.value);
                                setFocusedInput({ type: 'tire_size', index: idx });
                              }}
                              onFocus={() => setFocusedInput({ type: 'tire_size', index: idx })}
                            />
                            {focusedInput?.type === 'tire_size' && focusedInput?.index === idx && (
                              <div className="suggestions-dropdown">
                                {masterData.tire_size
                                  .filter(s => s.toLowerCase().includes(item.tire_size.toLowerCase()))
                                  .map(s => (
                                    <div 
                                      key={s} 
                                      className="suggestion-item"
                                      onClick={() => {
                                        updateItem(item.id, 'tire_size', s);
                                        setFocusedInput(null);
                                      }}
                                    >
                                      {s}
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>

                          <div className="form-group">
                            <label>Pattern/Model (Opsional)</label>
                            <input
                              type="text"
                              className="input-control"
                              placeholder="e.g. Ecopia EP150"
                              value={item.tire_pattern}
                              onChange={e => updateItem(item.id, 'tire_pattern', e.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label>Posisi Pasang (Opsional)</label>
                            <select
                              className="select-control"
                              value={item.tire_position}
                              onChange={e => updateItem(item.id, 'tire_position', e.target.value)}
                            >
                              <option value="">-- Tanpa Posisi --</option>
                              <option value="Depan">Depan</option>
                              <option value="Belakang">Belakang</option>
                              <option value="Kiri">Kiri</option>
                              <option value="Kanan">Kanan</option>
                              <option value="Set">Set (4 Roda)</option>
                            </select>
                          </div>
                        </>
                      ) : (
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label>Merek/Nama Barang</label>
                          <input
                            type="text"
                            className="input-control"
                            placeholder="e.g. Shell Helix HX8 4L"
                            value={item.goods_brand}
                            onChange={e => updateItem(item.id, 'goods_brand', e.target.value)}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {item.category === 'Jasa' && (
                    <>
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label>Tipe Layanan Jasa</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="e.g. Spooring 3D"
                          value={item.service_type}
                          onChange={e => {
                            updateItem(item.id, 'service_type', e.target.value);
                            setFocusedInput({ type: 'service_type', index: idx });
                          }}
                          onFocus={() => setFocusedInput({ type: 'service_type', index: idx })}
                        />
                        {focusedInput?.type === 'service_type' && focusedInput?.index === idx && (
                          <div className="suggestions-dropdown">
                            {masterData.service_type
                              .filter(s => s.toLowerCase().includes(item.service_type.toLowerCase()))
                              .map(s => (
                                <div 
                                  key={s} 
                                  className="suggestion-item"
                                  onClick={() => {
                                    updateItem(item.id, 'service_type', s);
                                    setFocusedInput(null);
                                  }}
                                >
                                  {s}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Teknisi Kerja (Opsional)</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="e.g. Slamet"
                          value={item.technician}
                          onChange={e => updateItem(item.id, 'technician', e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {item.category === 'Understeel' && (
                    <>
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label>Nama Part Kaki-Kaki</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="e.g. Long Tierod"
                          value={item.item_name}
                          onChange={e => {
                            updateItem(item.id, 'item_name', e.target.value);
                            setFocusedInput({ type: 'understeel_part', index: idx });
                          }}
                          onFocus={() => setFocusedInput({ type: 'understeel_part', index: idx })}
                        />
                        {focusedInput?.type === 'understeel_part' && focusedInput?.index === idx && (
                          <div className="suggestions-dropdown">
                            {masterData.understeel_part
                              .filter(p => p.toLowerCase().includes(item.item_name.toLowerCase()))
                              .map(p => (
                                <div 
                                  key={p} 
                                  className="suggestion-item"
                                  onClick={() => {
                                    updateItem(item.id, 'item_name', p);
                                    setFocusedInput(null);
                                  }}
                                >
                                  {p}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Merek Part (Opsional)</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="e.g. 555 / SGP"
                          value={item.part_brand}
                          onChange={e => updateItem(item.id, 'part_brand', e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Posisi Part Pasang</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="e.g. Depan Kiri"
                          value={item.part_position}
                          onChange={e => {
                            updateItem(item.id, 'part_position', e.target.value);
                            setFocusedInput({ type: 'part_position', index: idx });
                          }}
                          onFocus={() => setFocusedInput({ type: 'part_position', index: idx })}
                        />
                        {focusedInput?.type === 'part_position' && focusedInput?.index === idx && (
                          <div className="suggestions-dropdown">
                            {masterData.part_position
                              .filter(p => p.toLowerCase().includes(item.part_position.toLowerCase()))
                              .map(p => (
                                <div 
                                  key={p} 
                                  className="suggestion-item"
                                  onClick={() => {
                                    updateItem(item.id, 'part_position', p);
                                    setFocusedInput(null);
                                  }}
                                >
                                  {p}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Teknisi Kerja (Opsional)</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="e.g. Agus"
                          value={item.technician}
                          onChange={e => updateItem(item.id, 'technician', e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {/* Math fields */}
                  <div className="form-group">
                    <label>Qty</label>
                    <input
                      type="number"
                      className="input-control"
                      min="1"
                      required
                      value={item.quantity}
                      onChange={e => updateItem(item.id, 'quantity', Math.max(1, Number(e.target.value)))}
                    />
                  </div>

                  <div className="form-group">
                    <label>Harga Satuan (Rp)</label>
                    <input
                      type="number"
                      className="input-control"
                      min="0"
                      required
                      value={item.unit_price}
                      onChange={e => updateItem(item.id, 'unit_price', Math.max(0, Number(e.target.value)))}
                    />
                  </div>

                  <div className="form-group">
                    <label>Diskon (Rp)</label>
                    <input
                      type="number"
                      className="input-control"
                      min="0"
                      value={item.discount}
                      onChange={e => updateItem(item.id, 'discount', Math.max(0, Number(e.target.value)))}
                    />
                  </div>

                  <div className="form-group">
                    <label>Subtotal (Rp)</label>
                    <div className="input-control" style={{ backgroundColor: 'hsl(222, 24%, 7%)', borderColor: 'var(--border-subtle)', color: 'var(--primary)', fontWeight: 700 }}>
                      {getItemSubtotal(item).toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Sales Item (Opsional - fallback ke Sales Utama)</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. Budi"
                      value={item.sales_person}
                      onChange={e => {
                        updateItem(item.id, 'sales_person', e.target.value);
                        setFocusedInput({ type: 'item_sales', index: idx });
                      }}
                      onFocus={() => setFocusedInput({ type: 'item_sales', index: idx })}
                    />
                    {focusedInput?.type === 'item_sales' && focusedInput?.index === idx && (
                      <div className="suggestions-dropdown">
                        {masterData.sales
                          .filter(s => s.toLowerCase().includes(item.sales_person.toLowerCase()))
                          .map(s => (
                            <div 
                              key={s} 
                              className="suggestion-item"
                              onClick={() => {
                                updateItem(item.id, 'sales_person', s);
                                setFocusedInput(null);
                              }}
                            >
                              {s}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Catatan Item</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. Ban dibungkus, bawa pulang"
                      value={item.notes}
                      onChange={e => updateItem(item.id, 'notes', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Invoice Summary and Submit */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(222, 24%, 11%)', padding: '1.25rem 2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', gap: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL INVOICE (RP)</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2.25rem', color: 'var(--primary)' }}>
              {getInvoiceTotal().toLocaleString('id-ID')}
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="form-group" style={{ width: '130px' }}>
              <label>Status Simpan</label>
              <select
                className="select-control"
                value={status}
                onChange={e => setStatus(e.target.value as any)}
              >
                <option value="Draft">Draft</option>
                <option value="Final">Final (Finalisasi)</option>
              </select>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ alignSelf: 'flex-end', height: '42px', padding: '0 1.5rem' }} 
              disabled={loading || items.length === 0}
            >
              <Save size={16} /> {loading ? 'Menyimpan...' : 'Simpan Transaksi'}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
