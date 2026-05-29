import { Router, Request, Response } from 'express';
import { getDb } from '../db/db.js';

const router = Router();

// Helper to construct global SQL filters from query parameters
function buildGlobalFilters(req: Request) {
  const { startDate, endDate, salesPerson, carBrand, carSeries, carYear } = req.query;
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
  if (salesPerson) {
    // If a salesperson filter is applied, match either the main invoice salesperson or an item's salesperson
    whereClauses.push('(i.sales_person = ? OR ii.sales_person = ?)');
    params.push(salesPerson, salesPerson);
  }
  if (carBrand) {
    whereClauses.push('i.car_brand = ?');
    params.push(carBrand);
  }
  if (carSeries) {
    whereClauses.push('i.car_series = ?');
    params.push(carSeries);
  }
  if (carYear) {
    whereClauses.push('i.car_year = ?');
    params.push(Number(carYear));
  }

  return {
    whereSql: whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '',
    params
  };
}

// 1. OVERVIEW DASHBOARD
router.get('/overview', async (req: Request, res: Response) => {
  const db = await getDb();
  const { whereSql, params } = buildGlobalFilters(req);

  try {
    // Scorecards
    const scorecardsQuery = `
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
    const stats = await db.get<any>(scorecardsQuery, params);

    const totalRevenue = stats?.total_revenue || 0;
    const totalInvoices = stats?.total_invoices || 0;
    const avgInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

    // Daily/Monthly Revenue Trend
    const trendQuery = `
      SELECT 
        i.invoice_date as date,
        SUM(ii.subtotal) as revenue
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql}
      GROUP BY i.invoice_date
      ORDER BY i.invoice_date ASC
    `;
    const trends = await db.all(trendQuery, params);

    // Revenue Proportion by Category
    const propQuery = `
      SELECT 
        ii.category,
        COALESCE(SUM(ii.subtotal), 0) as revenue
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql}
      GROUP BY ii.category
    `;
    const proportion = await db.all(propQuery, params);

    // Top Items
    const topItemsQuery = `
      SELECT 
        ii.category,
        ii.item_name,
        SUM(ii.quantity) as qty,
        SUM(ii.subtotal) as revenue
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql}
      GROUP BY ii.category, ii.item_name
      ORDER BY revenue DESC
    `;
    const topItemsAll = await db.all(topItemsQuery, params);
    
    const topBarang = topItemsAll.filter(x => x.category === 'Barang').slice(0, 5);
    const topJasa = topItemsAll.filter(x => x.category === 'Jasa').slice(0, 5);
    const topUndersteel = topItemsAll.filter(x => x.category === 'Understeel').slice(0, 5);

    res.json({
      success: true,
      data: {
        metrics: {
          totalRevenue,
          totalInvoices,
          avgInvoiceValue,
          tireQtySold: stats?.tire_qty || 0,
          servicesPerformed: stats?.service_qty || 0,
          understeelReplaced: stats?.understeel_qty || 0
        },
        trends,
        proportion,
        topItems: {
          Barang: topBarang,
          Jasa: topJasa,
          Understeel: topUndersteel
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

// 2. TIRE ANALYTICS
router.get('/tires', async (req: Request, res: Response) => {
  const db = await getDb();
  const { startDate, endDate, salesPerson, tireSize, tireBrand } = req.query;
  
  const whereClauses: string[] = ["i.status = 'Final'", "ii.category = 'Barang'", "ii.goods_type = 'Ban'"];
  const params: any[] = [];

  if (startDate) {
    whereClauses.push('i.invoice_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    whereClauses.push('i.invoice_date <= ?');
    params.push(endDate);
  }
  if (salesPerson) {
    whereClauses.push('(i.sales_person = ? OR ii.sales_person = ?)');
    params.push(salesPerson, salesPerson);
  }
  if (tireSize) {
    whereClauses.push('ii.tire_size = ?');
    params.push(tireSize);
  }
  if (tireBrand) {
    whereClauses.push('ii.tire_brand = ?');
    params.push(tireBrand);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  try {
    // Basic Metrics
    const metricsQuery = `
      SELECT 
        SUM(ii.quantity) as qty,
        SUM(ii.subtotal) as revenue
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql}
    `;
    const metrics = await db.get<any>(metricsQuery, params);
    
    const qty = metrics?.qty || 0;
    const revenue = metrics?.revenue || 0;
    const avgPrice = qty > 0 ? revenue / qty : 0;

    // Top Combinations
    const topCombinations = await db.all(`
      SELECT 
        ii.tire_brand,
        ii.tire_size,
        SUM(ii.quantity) as qty,
        SUM(ii.subtotal) as revenue
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql}
      GROUP BY ii.tire_brand, ii.tire_size
      ORDER BY qty DESC, revenue DESC
      LIMIT 10
    `, params);

    // Top Sizes
    const topSizes = await db.all(`
      SELECT 
        ii.tire_size,
        SUM(ii.quantity) as qty,
        SUM(ii.subtotal) as revenue
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql}
      GROUP BY ii.tire_size
      ORDER BY qty DESC
      LIMIT 10
    `, params);

    // Top Brands
    const topBrands = await db.all(`
      SELECT 
        ii.tire_brand,
        SUM(ii.quantity) as qty,
        SUM(ii.subtotal) as revenue
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql}
      GROUP BY ii.tire_brand
      ORDER BY qty DESC
      LIMIT 10
    `, params);

    res.json({
      success: true,
      data: {
        metrics: {
          tireQtySold: qty,
          tireRevenue: revenue,
          avgTirePrice: avgPrice
        },
        topCombinations,
        topSizes,
        topBrands
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

// 3. UNDERSTEEL ANALYTICS
router.get('/understeel', async (req: Request, res: Response) => {
  const db = await getDb();
  const { startDate, endDate, salesPerson, partName, position, carBrand, carSeries, carYear } = req.query;

  const whereClauses: string[] = ["i.status = 'Final'", "ii.category = 'Understeel'"];
  const params: any[] = [];

  if (startDate) {
    whereClauses.push('i.invoice_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    whereClauses.push('i.invoice_date <= ?');
    params.push(endDate);
  }
  if (salesPerson) {
    whereClauses.push('(i.sales_person = ? OR ii.sales_person = ?)');
    params.push(salesPerson, salesPerson);
  }
  if (partName) {
    whereClauses.push('ii.item_name = ?');
    params.push(partName);
  }
  if (position) {
    whereClauses.push('ii.part_position = ?');
    params.push(position);
  }
  if (carBrand) {
    whereClauses.push('i.car_brand = ?');
    params.push(carBrand);
  }
  if (carSeries) {
    whereClauses.push('i.car_series = ?');
    params.push(carSeries);
  }
  if (carYear) {
    whereClauses.push('i.car_year = ?');
    params.push(Number(carYear));
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  try {
    // Understeel Metrics
    const metrics = await db.get<any>(`
      SELECT 
        SUM(ii.quantity) as qty,
        SUM(ii.subtotal) as revenue
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql}
    `, params);

    // Top Parts by Qty
    const topPartsQty = await db.all(`
      SELECT 
        ii.item_name,
        SUM(ii.quantity) as qty,
        SUM(ii.subtotal) as revenue
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql}
      GROUP BY ii.item_name
      ORDER BY qty DESC
      LIMIT 10
    `, params);

    // Top Parts by Revenue
    const topPartsRevenue = await db.all(`
      SELECT 
        ii.item_name,
        SUM(ii.quantity) as qty,
        SUM(ii.subtotal) as revenue
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql}
      GROUP BY ii.item_name
      ORDER BY revenue DESC
      LIMIT 10
    `, params);

    // Car and Part Frequency Matrix (answering: which parts are replaced on which cars most often?)
    const matrix = await db.all(`
      SELECT 
        ii.item_name as part_name,
        i.car_brand,
        i.car_series,
        SUM(ii.quantity) as qty,
        COUNT(DISTINCT i.id) as invoice_count,
        SUM(ii.subtotal) as revenue
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql}
      GROUP BY ii.item_name, i.car_brand, i.car_series
      ORDER BY qty DESC
      LIMIT 20
    `, params);

    res.json({
      success: true,
      data: {
        metrics: {
          understeelQty: metrics?.qty || 0,
          understeelRevenue: metrics?.revenue || 0
        },
        topPartsQty,
        topPartsRevenue,
        matrix
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

// 4. SERVICE ANALYTICS (Volume & Attach Rate)
router.get('/services', async (req: Request, res: Response) => {
  const db = await getDb();
  const { startDate, endDate, salesPerson } = req.query;

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
  if (salesPerson) {
    whereClauses.push('(i.sales_person = ? OR ii.sales_person = ?)');
    params.push(salesPerson, salesPerson);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  try {
    // 4.1 VOLUME LAYANAN
    // Top Services by Qty & Revenue
    const topServices = await db.all(`
      SELECT 
        ii.item_name as service_name,
        SUM(ii.quantity) as qty,
        SUM(ii.subtotal) as revenue
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql} AND ii.category = 'Jasa'
      GROUP BY ii.item_name
      ORDER BY qty DESC
    `, params);

    // Service Trend (Daily/Monthly)
    const trends = await db.all(`
      SELECT 
        i.invoice_date as date,
        SUM(ii.quantity) as qty,
        SUM(ii.subtotal) as revenue
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql} AND ii.category = 'Jasa'
      GROUP BY i.invoice_date
      ORDER BY i.invoice_date ASC
    `, params);

    // 4.2 ATTACH RATE
    // For attach rate, we calculate the statistics based on final invoices in this active period
    
    // Denominator 1: Total invoices that contain Ban
    const banInvoiceIdsQuery = `
      SELECT DISTINCT i.id
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql} AND ii.category = 'Barang' AND ii.goods_type = 'Ban'
    `;
    const banInvoices = await db.all(banInvoiceIdsQuery, params);
    const banInvoiceIds = banInvoices.map(x => x.id);
    const banInvoicesCount = banInvoiceIds.length;

    // Denominator 2: Total invoices that contain Understeel
    const understeelInvoiceIdsQuery = `
      SELECT DISTINCT i.id
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql} AND ii.category = 'Understeel'
    `;
    const understeelInvoices = await db.all(understeelInvoiceIdsQuery, params);
    const understeelInvoiceIds = understeelInvoices.map(x => x.id);
    const understeelInvoicesCount = understeelInvoiceIds.length;

    // Fetch all final services in active period
    const servicesList = await db.all(`
      SELECT DISTINCT value as service_name 
      FROM master_data 
      WHERE category = 'service_type'
    `);

    const attachRateTire: any[] = [];
    const attachRateUndersteel: any[] = [];

    // Calculate rates for each service type
    for (const service of servicesList) {
      const sName = service.service_name;

      // 1. Tire attachment
      if (banInvoicesCount > 0) {
        // Count how many of these tire invoices also contain this service
        // We can pass the array of invoice IDs dynamically in SQL
        const placeholders = banInvoiceIds.map(() => '?').join(',');
        const attachedCount = await db.get<{ count: number }>(
          `SELECT COUNT(DISTINCT invoice_id) as count 
           FROM invoice_items 
           WHERE category = 'Jasa' AND item_name LIKE ? AND invoice_id IN (${placeholders})`,
          [`%${sName}%`, ...banInvoiceIds]
        );

        const count = attachedCount?.count || 0;
        attachRateTire.push({
          serviceName: sName,
          attachedCount: count,
          baseCount: banInvoicesCount,
          rate: (count / banInvoicesCount) * 100
        });
      } else {
        attachRateTire.push({
          serviceName: sName,
          attachedCount: 0,
          baseCount: 0,
          rate: 0
        });
      }

      // 2. Understeel attachment
      if (understeelInvoicesCount > 0) {
        const placeholders = understeelInvoiceIds.map(() => '?').join(',');
        const attachedCount = await db.get<{ count: number }>(
          `SELECT COUNT(DISTINCT invoice_id) as count 
           FROM invoice_items 
           WHERE category = 'Jasa' AND item_name LIKE ? AND invoice_id IN (${placeholders})`,
          [`%${sName}%`, ...understeelInvoiceIds]
        );

        const count = attachedCount?.count || 0;
        attachRateUndersteel.push({
          serviceName: sName,
          attachedCount: count,
          baseCount: understeelInvoicesCount,
          rate: (count / understeelInvoicesCount) * 100
        });
      } else {
        attachRateUndersteel.push({
          serviceName: sName,
          attachedCount: 0,
          baseCount: 0,
          rate: 0
        });
      }
    }

    // Sort by rate descending
    attachRateTire.sort((a, b) => b.rate - a.rate);
    attachRateUndersteel.sort((a, b) => b.rate - a.rate);

    res.json({
      success: true,
      data: {
        volume: {
          topServices,
          trends
        },
        attachRate: {
          tireCount: banInvoicesCount,
          understeelCount: understeelInvoicesCount,
          tireAttachments: attachRateTire,
          understeelAttachments: attachRateUndersteel
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

// 5. SALES LEADERBOARD
router.get('/leaderboard', async (req: Request, res: Response) => {
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
    // 1. Fetch raw metrics per salesperson
    // We group by salesperson. Note that items can have an overriding salesperson.
    // If the item salesperson is empty, it falls back to the invoice salesperson.
    
    // First, let's query all distinct salesperson names active in the period
    const activeSalesList = await db.all(`
      SELECT DISTINCT COALESCE(ii.sales_person, i.sales_person) as sales_name
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereSql} AND COALESCE(ii.sales_person, i.sales_person) IS NOT NULL AND COALESCE(ii.sales_person, i.sales_person) != ''
    `, params);

    const stats: any[] = [];

    for (const sales of activeSalesList) {
      const name = sales.sales_name;

      // Total revenue specifically credited to this salesperson (sum of subtotals of items where sales_person = name OR (ii.sales_person IS NULL AND i.sales_person = name))
      const revenueData = await db.get<{ revenue: number }>(
        `SELECT SUM(ii.subtotal) as revenue
         FROM invoices i
         LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
         ${whereSql} AND COALESCE(ii.sales_person, i.sales_person) = ?`,
        [...params, name]
      );

      // Final unique invoice count credited to this salesperson (invoices containing at least one item handled by this salesperson)
      const invoiceCountData = await db.get<{ count: number }>(
        `SELECT COUNT(DISTINCT i.id) as count
         FROM invoices i
         LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
         ${whereSql} AND COALESCE(ii.sales_person, i.sales_person) = ?`,
        [...params, name]
      );

      // Category specific revenue splits
      const splitData = await db.all(
        `SELECT ii.category, SUM(ii.subtotal) as revenue
         FROM invoices i
         LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
         ${whereSql} AND COALESCE(ii.sales_person, i.sales_person) = ?
         GROUP BY ii.category`,
        [...params, name]
      );

      // Tire quantity sold
      const tireQtyData = await db.get<{ qty: number }>(
        `SELECT SUM(ii.quantity) as qty
         FROM invoices i
         LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
         ${whereSql} AND COALESCE(ii.sales_person, i.sales_person) = ? AND ii.category = 'Barang' AND ii.goods_type = 'Ban'`,
        [...params, name]
      );

      const revenueSplit = { Barang: 0, Jasa: 0, Understeel: 0 };
      splitData.forEach((row: any) => {
        if (row.category in revenueSplit) {
          (revenueSplit as any)[row.category] = row.revenue;
        }
      });

      const totalRevenue = revenueData?.revenue || 0;
      const invoiceCount = invoiceCountData?.count || 0;
      const avgInvoiceValue = invoiceCount > 0 ? totalRevenue / invoiceCount : 0;
      const tireQty = tireQtyData?.qty || 0;

      stats.push({
        salesPerson: name,
        totalRevenue,
        invoiceCount,
        avgInvoiceValue,
        revenueSplit,
        tireQtySold: tireQty,
        // placeholders for index and scores
        revenueIndex: 0,
        invoiceIndex: 0,
        salesScore: 0
      });
    }

    // 2. Perform score index calculations
    if (stats.length > 0) {
      const maxRevenue = Math.max(...stats.map(x => x.totalRevenue));
      const maxInvoices = Math.max(...stats.map(x => x.invoiceCount));

      stats.forEach(item => {
        item.revenueIndex = maxRevenue > 0 ? item.totalRevenue / maxRevenue : 0;
        item.invoiceIndex = maxInvoices > 0 ? item.invoiceCount / maxInvoices : 0;
        // Sales Score = (Revenue Index * 0.6) + (Invoice Index * 0.4)
        item.salesScore = (item.revenueIndex * 0.6) + (item.invoiceIndex * 0.4);
      });

      // 3. Sort leaderboard by Score DESC, and tiebreak by Revenue DESC
      stats.sort((a, b) => {
        if (b.salesScore !== a.salesScore) {
          return b.salesScore - a.salesScore;
        }
        return b.totalRevenue - a.totalRevenue;
      });
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

export default router;
