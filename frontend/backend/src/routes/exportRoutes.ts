import { Router, Request, Response } from 'express';
import { getDb } from '../db/db.js';

const router = Router();

// Helper to escape CSV cell values
function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  // Replace double quotes with two double quotes
  str = str.replace(/"/g, '""');
  // Wrap in double quotes if it contains comma, newline or quotes
  if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
    return `"${str}"`;
  }
  return str;
}

// 1. EXPORT INVOICES HEADERS CSV
router.get('/invoices', async (req: Request, res: Response) => {
  const db = await getDb();
  const { startDate, endDate } = req.query;

  let query = `
    SELECT i.*, 
           (SELECT COALESCE(SUM(subtotal), 0) FROM invoice_items WHERE invoice_id = i.id) as total_amount
    FROM invoices i
    WHERE 1=1
  `;
  const params: any[] = [];

  if (startDate) {
    query += ' AND i.invoice_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND i.invoice_date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY i.invoice_date DESC, i.invoice_number DESC';

  try {
    const rows = await db.all(query, params);
    
    // Construct CSV Header
    const csvHeaders = ['ID', 'Invoice Number', 'Invoice Date', 'Customer Name', 'Car Brand', 'Car Series', 'Car Year', 'Main Sales Person', 'Status', 'Notes', 'Total Amount'];
    
    // Construct CSV Rows
    const csvRows = rows.map(r => [
      r.id,
      r.invoice_number,
      r.invoice_date,
      r.customer_name,
      r.car_brand,
      r.car_series,
      r.car_year,
      r.sales_person || '',
      r.status,
      r.notes || '',
      r.total_amount
    ].map(escapeCSV).join(','));

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=Invoices.csv');
    res.status(200).send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

// 2. EXPORT INVOICE ITEMS CSV
router.get('/items', async (req: Request, res: Response) => {
  const db = await getDb();
  const { startDate, endDate } = req.query;

  let query = `
    SELECT ii.*, i.invoice_number, i.invoice_date, i.customer_name, i.car_brand, i.car_series, i.car_year
    FROM invoice_items ii
    LEFT JOIN invoices i ON ii.invoice_id = i.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (startDate) {
    query += ' AND i.invoice_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND i.invoice_date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY i.invoice_date DESC, i.invoice_number DESC, ii.id ASC';

  try {
    const rows = await db.all(query, params);
    
    // Construct CSV Header
    const csvHeaders = [
      'ID', 'Invoice ID', 'Invoice Number', 'Invoice Date', 'Customer Name', 
      'Car Brand', 'Car Series', 'Car Year', 'Category', 'Item Name', 
      'Quantity', 'Unit Price', 'Discount', 'Subtotal', 'Item Sales Person', 'Item Notes',
      'Goods Type', 'Goods Brand', 'Tire Brand', 'Tire Size', 'Tire Pattern', 'Tire Position',
      'Service Type', 'Technician', 'Part Brand', 'Part Position'
    ];
    
    // Construct CSV Rows
    const csvRows = rows.map(r => [
      r.id,
      r.invoice_id,
      r.invoice_number,
      r.invoice_date,
      r.customer_name,
      r.car_brand,
      r.car_series,
      r.car_year,
      r.category,
      r.item_name,
      r.quantity,
      r.unit_price,
      r.discount,
      r.subtotal,
      r.sales_person || '',
      r.notes || '',
      r.goods_type || '',
      r.goods_brand || '',
      r.tire_brand || '',
      r.tire_size || '',
      r.tire_pattern || '',
      r.tire_position || '',
      r.service_type || '',
      r.technician || '',
      r.part_brand || '',
      r.part_position || ''
    ].map(escapeCSV).join(','));

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=InvoiceItems.csv');
    res.status(200).send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

// 3. EXPORT DASHBOARD SUMMARY CSV
router.get('/summary', async (req: Request, res: Response) => {
  const db = await getDb();
  const { startDate, endDate } = req.query;

  const whereClauses: string[] = ["i.status = 'Final'"];
  const params: any[] = [];

  if (startDate) {
    whereClauses.push('i.invoice_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    whereClauses.push('i.invoice_date <= ?');
    params.push(endDate);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  try {
    const statsQuery = `
      SELECT 
        COALESCE(SUM(ii.subtotal), 0) as total_revenue,
        COUNT(DISTINCT i.id) as total_invoices,
        COALESCE(SUM(CASE WHEN ii.category = 'Barang' AND ii.goods_type = 'Ban' THEN ii.quantity ELSE 0 END), 0) as tire_qty,
        COALESCE(SUM(CASE WHEN ii.category = 'Jasa' THEN ii.quantity ELSE 0 END), 0) as service_qty,
        COALESCE(SUM(CASE WHEN ii.category = 'Understeel' THEN ii.quantity ELSE 0 END), 0) as understeel_qty
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql}
    `;
    const stats = await db.get<any>(statsQuery, params);

    const totalRevenue = stats?.total_revenue || 0;
    const totalInvoices = stats?.total_invoices || 0;
    const avgInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;
    const tireQty = stats?.tire_qty || 0;
    const serviceQty = stats?.service_qty || 0;
    const understeelQty = stats?.understeel_qty || 0;

    // Construct CSV
    const csvContent = [
      'Summary Metric,Value',
      `Period Start,${startDate || 'All Time'}`,
      `Period End,${endDate || 'All Time'}`,
      `Total Revenue,${totalRevenue}`,
      `Total Final Invoices,${totalInvoices}`,
      `Average Invoice Value,${avgInvoiceValue}`,
      `Tire Quantity Sold,${tireQty}`,
      `Services Performed,${serviceQty}`,
      `Understeel Replaced,${understeelQty}`
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=DashboardSummary.csv');
    res.status(200).send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

// 4. GET SAMPLE IMPORT CSV TEMPLATE
router.get('/sample-template', (req: Request, res: Response) => {
  const csvHeaders = [
    'NO', 'NAMA OUTLET', 'TH', 'BLN', 'TGL', 'NO FACTUR', 'MERK MOBIL', 'SERIES MOBIL', 
    'THN MOBIL', 'KONSUMEN', 'DETAIL', 'ITEM', 'KATEGORI', 'JML', 'OMZET BRUTO', 'DISKON', 'OMZET NETT', 'SALES'
  ];

  const csvRows = [
    [
      '1', 'BENGKEL MERDEKA', '2026', '4', '10', 'INV/2026/04/0001', 'TOYOTA', 'AVANZA', 
      '2019', 'ANDI WIJAYA', 'BAN BRIDGESTONE ECOPIA 185 70 14 DEPAN KANAN', 'BAN ECOPIA', 'BARANG', '2', '1.600.000', '100.000', '1.500.000', 'DIAN'
    ],
    [
      '2', 'BENGKEL MERDEKA', '2026', '4', '10', 'INV/2026/04/0001', 'TOYOTA', 'AVANZA', 
      '2019', 'ANDI WIJAYA', 'JASA SPOORING 3D DAN BALANCING', 'SPOORING', 'JASA', '1', '250.000', '0', '250.000', 'DIAN'
    ],
    [
      '3', 'BENGKEL MERDEKA', '2026', '4', '12', 'INV/2026/04/0002', 'HONDA', 'JAZZ', 
      '2017', 'BUDI SANTOSO', 'TIEROD 555 SE-3841 DEPAN KIRI', 'TIEROD', 'UNDERSTEEL', '2', '600.000', '50.000', '550.000', 'ARIS'
    ]
  ].map(row => row.map(escapeCSV).join(','));

  const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=Template_Import_CRM.csv');
  res.status(200).send(csvContent);
});

export default router;
