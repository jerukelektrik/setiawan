import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  History, 
  LayoutDashboard, 
  Disc, 
  Wrench, 
  Activity, 
  Trophy, 
  Settings, 
  Download,
  Calendar,
  Filter,
  RefreshCw,
  Car,
  LogOut,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react';

// Views (lazy components implemented directly below or imported)
import InvoiceForm from './components/InvoiceForm.tsx';
import InvoiceHistory from './components/InvoiceHistory.tsx';
import OverviewDashboard from './components/OverviewDashboard.tsx';
import TireAnalytics from './components/TireAnalytics.tsx';
import UndersteelAnalytics from './components/UndersteelAnalytics.tsx';
import ServiceAnalytics from './components/ServiceAnalytics.tsx';
import SalesLeaderboard from './components/SalesLeaderboard.tsx';
import MasterDataPanel from './components/MasterDataPanel.tsx';
import ExportPanel from './components/ExportPanel.tsx';

export interface MasterData {
  sales: string[];
  car_brand: string[];
  car_series: string[];
  service_type: string[];
  goods_type: string[];
  tire_brand: string[];
  tire_size: string[];
  understeel_part: string[];
  part_position: string[];
}

export interface GlobalFilters {
  startDate: string;
  endDate: string;
  salesPerson: string;
  carBrand: string;
  carSeries: string;
  carYear: string;
}

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => localStorage.getItem('crm_auth') === 'true');
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!usernameInput || !passwordInput) {
      setLoginError('Username dan password wajib diisi!');
      return;
    }

    setLoginLoading(true);

    // Realistic premium delay
    setTimeout(() => {
      if (usernameInput.trim().toLowerCase() === 'rizki' && passwordInput === 'heaven123') {
        setIsAuthenticated(true);
        localStorage.setItem('crm_auth', 'true');
        setLoginLoading(false);
        setLoginError('');
      } else {
        setLoginError('Username atau password salah!');
        setLoginLoading(false);
      }
    }, 850);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('crm_auth');
    setUsernameInput('');
    setPasswordInput('');
  };

  // Filters State
  const getThirtyDaysAgo = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  };
  
  const getToday = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [filters, setFilters] = useState<GlobalFilters>({
    startDate: getThirtyDaysAgo(),
    endDate: getToday(),
    salesPerson: '',
    carBrand: '',
    carSeries: '',
    carYear: ''
  });

  // Master Data Suggestions State
  const [masterData, setMasterData] = useState<MasterData>({
    sales: [],
    car_brand: [],
    car_series: [],
    service_type: [],
    goods_type: [],
    tire_brand: [],
    tire_size: [],
    understeel_part: [],
    part_position: []
  });

  const [loadingMaster, setLoadingMaster] = useState<boolean>(true);

  // Fetch Master Data Autocompletes
  const fetchMasterData = async () => {
    setLoadingMaster(true);
    try {
      const res = await fetch('/api/master-data');
      const json = await res.json();
      if (json.success) {
        setMasterData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch master data:', err);
    } finally {
      setLoadingMaster(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  const handleFilterChange = (key: keyof GlobalFilters, val: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const resetFilters = () => {
    setFilters({
      startDate: getThirtyDaysAgo(),
      endDate: getToday(),
      salesPerson: '',
      carBrand: '',
      carSeries: '',
      carYear: ''
    });
  };

  const handleEditInvoice = (id: number) => {
    setEditingInvoiceId(id);
    setActiveTab('input');
  };

  const handleInvoiceSaved = () => {
    setEditingInvoiceId(null);
    fetchMasterData(); // refresh options in case they added new items
    setActiveTab('history');
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewDashboard filters={filters} onNavigateToTab={setActiveTab} />;
      case 'input':
        return (
          <InvoiceForm 
            invoiceId={editingInvoiceId} 
            masterData={masterData} 
            onSaved={handleInvoiceSaved} 
            onCancel={() => {
              setEditingInvoiceId(null);
              setActiveTab('history');
            }} 
          />
        );
      case 'history':
        return <InvoiceHistory masterData={masterData} onEditInvoice={handleEditInvoice} />;
      case 'tires':
        return <TireAnalytics filters={filters} masterData={masterData} />;
      case 'understeel':
        return <UndersteelAnalytics filters={filters} masterData={masterData} />;
      case 'services':
        return <ServiceAnalytics filters={filters} />;
      case 'leaderboard':
        return <SalesLeaderboard filters={filters} />;
      case 'master-data':
        return <MasterDataPanel masterData={masterData} onRefresh={fetchMasterData} />;
      case 'export':
        return <ExportPanel filters={filters} />;
      default:
        return <OverviewDashboard filters={filters} onNavigateToTab={setActiveTab} />;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <div className="login-glow-1"></div>
        <div className="login-glow-2"></div>
        
        <div className="login-card">
          <div className="login-header">
            <span className="login-logo">🚗</span>
            <h1 className="login-brand">BENGKEL BAN</h1>
            <p className="login-subtitle">CRM Outlet MVP Login</p>
          </div>
          
          <form onSubmit={handleLogin} className="login-form">
            {loginError && (
              <div className="login-alert">
                <AlertTriangle size={16} />
                <span>{loginError}</span>
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dark)' }} />
                <input
                  id="username"
                  type="text"
                  placeholder="Masukkan username"
                  className="input-control"
                  style={{ paddingLeft: '36px' }}
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  disabled={loginLoading}
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dark)' }} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan password"
                  className="input-control"
                  style={{ paddingLeft: '36px', paddingRight: '36px' }}
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  disabled={loginLoading}
                />
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dark)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loginLoading}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.75rem', height: '40px' }}
              disabled={loginLoading}
            >
              {loginLoading ? 'Sedang Masuk...' : 'Masuk ke Aplikasi'}
            </button>
          </form>
          
          <div className="login-footer-text">
            Sistem Administrasi CRM Bengkel Ban &copy; 2026
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <aside className="left-sidebar">
        <div className="brand-section">
          <span className="brand-icon">🚗</span>
          <div>
            <h1 className="brand-title">BENGKEL BAN</h1>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-dark)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>CRM Outlet MVP</p>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <nav className="nav-links">
          <button 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => { setActiveTab('overview'); setEditingInvoiceId(null); }}
          >
            <LayoutDashboard size={16} /> Overview
          </button>
          <button 
            className={`nav-item ${activeTab === 'input' ? 'active' : ''}`}
            onClick={() => { setActiveTab('input'); setEditingInvoiceId(null); }}
          >
            <FileText size={16} /> Input Invoice
          </button>
          <button 
            className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => { setActiveTab('history'); setEditingInvoiceId(null); }}
          >
            <History size={16} /> Riwayat Invoice
          </button>
          <button 
            className={`nav-item ${activeTab === 'tires' ? 'active' : ''}`}
            onClick={() => { setActiveTab('tires'); setEditingInvoiceId(null); }}
          >
            <Disc size={16} /> Analitik Ban
          </button>
          <button 
            className={`nav-item ${activeTab === 'understeel' ? 'active' : ''}`}
            onClick={() => { setActiveTab('understeel'); setEditingInvoiceId(null); }}
          >
            <Car size={16} /> Analitik Understeel
          </button>
          <button 
            className={`nav-item ${activeTab === 'services' ? 'active' : ''}`}
            onClick={() => { setActiveTab('services'); setEditingInvoiceId(null); }}
          >
            <Wrench size={16} /> Analitik Jasa
          </button>
          <button 
            className={`nav-item ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('leaderboard'); setEditingInvoiceId(null); }}
          >
            <Trophy size={16} /> Leaderboard
          </button>
          <button 
            className={`nav-item ${activeTab === 'master-data' ? 'active' : ''}`}
            onClick={() => { setActiveTab('master-data'); setEditingInvoiceId(null); }}
          >
            <Settings size={16} /> Master Data
          </button>
          <button 
            className={`nav-item ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => { setActiveTab('export'); setEditingInvoiceId(null); }}
          >
            <Download size={16} /> Backup & Export
          </button>
        </nav>

        {/* Premium Logout Button */}
        <div className="logout-container">
          <button 
            className="nav-item" 
            onClick={handleLogout} 
            style={{ color: 'var(--color-cancelled)', border: '1px solid transparent', width: '100%', justifyContent: 'flex-start' }}
          >
            <LogOut size={16} /> Keluar (Logout)
          </button>
        </div>
      </aside>

      {/* Right Area containing filters and main content */}
      <div className="right-area">
        {/* Global Filters Panel - Visible except in Invoice Entry and Master Data views */}
        {activeTab !== 'input' && activeTab !== 'master-data' && activeTab !== 'history' && (
          <section className="filters-bar">
            <div className="filters-group">
              <span className="filter-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Filter size={12} /> Filter Global:
              </span>
              
              {/* Period Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={14} style={{ color: 'var(--text-dark)' }} />
                <input 
                  type="date" 
                  className="input-control" 
                  style={{ padding: '0.25rem 0.5rem', width: '130px', fontSize: '0.75rem' }} 
                  value={filters.startDate}
                  onChange={e => handleFilterChange('startDate', e.target.value)}
                />
                <span style={{ color: 'var(--text-dark)', fontSize: '0.75rem' }}>s.d</span>
                <input 
                  type="date" 
                  className="input-control" 
                  style={{ padding: '0.25rem 0.5rem', width: '130px', fontSize: '0.75rem' }} 
                  value={filters.endDate}
                  onChange={e => handleFilterChange('endDate', e.target.value)}
                />
              </div>

              {/* Sales Filter */}
              <select
                className="select-control"
                style={{ padding: '0.25rem 0.5rem', width: '120px', fontSize: '0.75rem' }}
                value={filters.salesPerson}
                onChange={e => handleFilterChange('salesPerson', e.target.value)}
              >
                <option value="">-- Semua Sales --</option>
                {masterData.sales.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Car Brand Filter */}
              <select
                className="select-control"
                style={{ padding: '0.25rem 0.5rem', width: '130px', fontSize: '0.75rem' }}
                value={filters.carBrand}
                onChange={e => {
                  handleFilterChange('carBrand', e.target.value);
                  handleFilterChange('carSeries', ''); // Reset series
                }}
              >
                <option value="">-- Semua Mobil --</option>
                {masterData.car_brand.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              {/* Car Series Filter */}
              {filters.carBrand && (
                <select
                  className="select-control"
                  style={{ padding: '0.25rem 0.5rem', width: '120px', fontSize: '0.75rem' }}
                  value={filters.carSeries}
                  onChange={e => handleFilterChange('carSeries', e.target.value)}
                >
                  <option value="">-- Semua Series --</option>
                  {masterData.car_series.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}

              {/* Car Year Filter */}
              <input
                type="number"
                placeholder="Tahun"
                className="input-control"
                style={{ padding: '0.25rem 0.5rem', width: '80px', fontSize: '0.75rem' }}
                value={filters.carYear}
                onChange={e => handleFilterChange('carYear', e.target.value)}
              />
            </div>

            <div>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                onClick={resetFilters}
              >
                <RefreshCw size={12} /> Reset Filter
              </button>
            </div>
          </section>
        )}

        {/* Main View Area */}
        <main className="main-content">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}
