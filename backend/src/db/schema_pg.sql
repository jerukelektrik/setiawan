-- PostgreSQL Database Schema for Bengkel Ban CRM

-- 1. Invoices Header Table
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_date TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    car_brand TEXT NOT NULL,
    car_series TEXT NOT NULL,
    car_year INTEGER NOT NULL,
    notes TEXT,
    sales_person TEXT,
    status TEXT NOT NULL DEFAULT 'Draft', -- 'Draft', 'Final', 'Cancelled'
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast searches
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- 2. Invoice Items Detail Table
CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL,
    category TEXT NOT NULL, -- 'Barang', 'Jasa', 'Understeel'
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DOUBLE PRECISION NOT NULL,
    discount DOUBLE PRECISION DEFAULT 0,
    subtotal DOUBLE PRECISION NOT NULL,
    sales_person TEXT,
    notes TEXT,
    
    -- Category-specific fields: Barang
    goods_type TEXT, -- 'Ban', 'Oli', 'Chemical', 'Lainnya'
    goods_brand TEXT,
    
    -- Category-specific fields: Ban (Barang -> Ban)
    tire_brand TEXT,
    tire_size TEXT,
    tire_pattern TEXT,
    tire_position TEXT,
    
    -- Category-specific fields: Jasa
    service_type TEXT,
    technician TEXT,
    
    -- Category-specific fields: Understeel
    part_brand TEXT,
    part_position TEXT,
    
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_items_category ON invoice_items(category);
CREATE INDEX IF NOT EXISTS idx_items_goods_type ON invoice_items(goods_type);
CREATE INDEX IF NOT EXISTS idx_items_tire_brand ON invoice_items(tire_brand);
CREATE INDEX IF NOT EXISTS idx_items_tire_size ON invoice_items(tire_size);

-- 3. Master Data Autocomplete Suggestions Table
CREATE TABLE IF NOT EXISTS master_data (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL, -- 'sales', 'car_brand', 'car_series', 'service_type', 'goods_type', 'tire_brand', 'tire_size', 'understeel_part', 'part_position'
    value TEXT NOT NULL,
    UNIQUE(category, value)
);

CREATE INDEX IF NOT EXISTS idx_master_category ON master_data(category);
