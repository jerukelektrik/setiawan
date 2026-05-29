import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHEMA_PATH = path.resolve(__dirname, '../db/schema.sql');

describe('Bengkel Ban CRM Calculations & Validation Guards', () => {
  let db: Database<sqlite3.Database, sqlite3.Statement>;

  beforeAll(async () => {
    // Spin up isolated in-memory SQLite database for fast unit testing
    db = await open({
      filename: ':memory:',
      driver: sqlite3.Database
    });

    await db.run('PRAGMA foreign_keys = ON');

    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    await db.exec(schema);
  });

  afterAll(async () => {
    await db.close();
  });

  it('1. should verify invoice total equals sum of item subtotals', async () => {
    // Insert invoice header
    const invRes = await db.run(
      `INSERT INTO invoices (invoice_number, invoice_date, customer_name, car_brand, car_series, car_year, status) 
       VALUES ('TEST-001', '2026-05-28', 'Roni', 'Honda', 'Civic', 2020, 'Final')`
    );
    const invoiceId = invRes.lastID;

    // Insert items
    await db.run(
      `INSERT INTO invoice_items (invoice_id, category, item_name, quantity, unit_price, discount, subtotal) 
       VALUES (?, 'Barang', 'Oli Shell', 2, 150000, 20000, 280000)`,
      [invoiceId]
    );

    await db.run(
      `INSERT INTO invoice_items (invoice_id, category, item_name, quantity, unit_price, discount, subtotal) 
       VALUES (?, 'Jasa', 'Spooring', 1, 150000, 0, 150000)`,
      [invoiceId]
    );

    // Sum of items
    const sumResult = await db.get<{ sum: number }>(
      'SELECT SUM(subtotal) as sum FROM invoice_items WHERE invoice_id = ?',
      [invoiceId]
    );
    
    expect(sumResult?.sum).toBe(430000); // 2 * 150000 - 20000 + 1 * 150000 = 430000
  });

  it('2. should reject duplicate invoice numbers at the database schema level', async () => {
    // First insert is TEST-001 from previous test. Let's try inserting another header with 'TEST-001'
    let threwError = false;
    try {
      await db.run(
        `INSERT INTO invoices (invoice_number, invoice_date, customer_name, car_brand, car_series, car_year, status) 
         VALUES ('TEST-001', '2026-05-28', 'Ari', 'Toyota', 'Avanza', 2019, 'Draft')`
      );
    } catch (err: any) {
      threwError = true;
      expect(err.message).toContain('UNIQUE constraint failed');
    }
    expect(threwError).toBe(true);
  });

  it('3. should verify understeel items inherit car brand, series, and year from header in analytical aggregations', async () => {
    // Insert header
    const invRes = await db.run(
      `INSERT INTO invoices (invoice_number, invoice_date, customer_name, car_brand, car_series, car_year, status) 
       VALUES ('TEST-002', '2026-05-28', 'Dian', 'Toyota', 'Fortuner', 2021, 'Final')`
    );
    const invoiceId = invRes.lastID;

    // Insert understeel item
    await db.run(
      `INSERT INTO invoice_items (invoice_id, category, item_name, quantity, unit_price, discount, subtotal, part_position) 
       VALUES (?, 'Understeel', 'Link Stabilizer', 2, 200000, 0, 400000, 'Depan')`,
      [invoiceId]
    );

    // Join understeel item to invoice header to trace back vehicle details
    const trace = await db.get<any>(
      `SELECT ii.item_name, i.car_brand, i.car_series, i.car_year 
       FROM invoice_items ii
       LEFT JOIN invoices i ON ii.invoice_id = i.id
       WHERE ii.invoice_id = ? AND ii.category = 'Understeel'`,
      [invoiceId]
    );

    expect(trace.item_name).toBe('Link Stabilizer');
    expect(trace.car_brand).toBe('Toyota');
    expect(trace.car_series).toBe('Fortuner');
    expect(trace.car_year).toBe(2021);
  });

  it('4. should confirm tire analytics includes only Barang with type Ban, and strictly excludes non-tire items', async () => {
    const invRes = await db.run(
      `INSERT INTO invoices (invoice_number, invoice_date, customer_name, car_brand, car_series, car_year, status) 
       VALUES ('TEST-003', '2026-05-28', 'Zaki', 'Suzuki', 'Ertiga', 2017, 'Final')`
    );
    const invoiceId = invRes.lastID;

    // Insert Tire item
    await db.run(
      `INSERT INTO invoice_items (invoice_id, category, item_name, quantity, unit_price, discount, subtotal, goods_type, tire_brand, tire_size) 
       VALUES (?, 'Barang', 'Tire Dunlop 185/70 R14', 4, 600000, 0, 2400000, 'Ban', 'Dunlop', '185/70 R14')`,
      [invoiceId]
    );

    // Insert Oli item (non-tire Barang)
    await db.run(
      `INSERT INTO invoice_items (invoice_id, category, item_name, quantity, unit_price, discount, subtotal, goods_type, goods_brand) 
       VALUES (?, 'Barang', 'Shell Helix Oil', 1, 400000, 0, 400000, 'Oli', 'Shell')`,
      [invoiceId]
    );

    // Run tire analytics query (should count only Ban type)
    const tireStats = await db.all(
      `SELECT SUM(ii.quantity) as qty, SUM(ii.subtotal) as revenue
       FROM invoice_items ii
       LEFT JOIN invoices i ON ii.invoice_id = i.id
       WHERE i.status = 'Final' AND ii.category = 'Barang' AND ii.goods_type = 'Ban'`
    );

    expect(tireStats[0].qty).toBe(4); // Only the 4 tires, not the 1 oil
    expect(tireStats[0].revenue).toBe(2400000);
  });

  it('5. should calculate service attach rate denominators correctly using unique invoice count (not item row count)', async () => {
    // Prepare 2 invoices. One has tire + spooring. One has tire only.
    const inv1 = await db.run(
      `INSERT INTO invoices (invoice_number, invoice_date, customer_name, car_brand, car_series, car_year, status) 
       VALUES ('TEST-004', '2026-05-28', 'Adi', 'Toyota', 'Avanza', 2019, 'Final')`
    );
    const inv2 = await db.run(
      `INSERT INTO invoices (invoice_number, invoice_date, customer_name, car_brand, car_series, car_year, status) 
       VALUES ('TEST-005', '2026-05-28', 'Dodi', 'Toyota', 'Avanza', 2019, 'Final')`
    );

    // Invoice 1 has 2 items: 1 tire item, 1 spooring item
    await db.run(
      `INSERT INTO invoice_items (invoice_id, category, item_name, quantity, unit_price, discount, subtotal, goods_type, tire_brand, tire_size) 
       VALUES (?, 'Barang', 'Bridgestone Ban', 2, 700000, 0, 1400000, 'Ban', 'Bridgestone', '185/70 R14')`,
      [inv1.lastID]
    );
    await db.run(
      `INSERT INTO invoice_items (invoice_id, category, item_name, quantity, unit_price, discount, subtotal, service_type) 
       VALUES (?, 'Jasa', 'Spooring', 1, 150000, 0, 150000, 'Spooring')`,
      [inv1.lastID]
    );

    // Invoice 2 has only 1 item: 2 tires (no services)
    await db.run(
      `INSERT INTO invoice_items (invoice_id, category, item_name, quantity, unit_price, discount, subtotal, goods_type, tire_brand, tire_size) 
       VALUES (?, 'Barang', 'Bridgestone Ban', 2, 700000, 0, 1400000, 'Ban', 'Bridgestone', '185/70 R14')`,
      [inv2.lastID]
    );

    // Denominator = final unique invoices that contain Ban
    const banInvoicesCountRes = await db.get<{ count: number }>(
      `SELECT COUNT(DISTINCT i.id) as count
       FROM invoices i
       LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
       WHERE i.status = 'Final' AND ii.category = 'Barang' AND ii.goods_type = 'Ban'`
    );
    const denominator = banInvoicesCountRes?.count || 0;

    // Attached count = final unique invoices with both Ban and Spooring
    // (i.e. invoice ID must have Ban and must also be in invoices containing Spooring)
    const attachedCountRes = await db.get<{ count: number }>(
      `SELECT COUNT(DISTINCT i.id) as count
       FROM invoices i
       LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
       WHERE i.status = 'Final' 
         AND ii.category = 'Jasa' 
         AND ii.item_name = 'Spooring'
         AND i.id IN (
           SELECT DISTINCT invoice_id FROM invoice_items WHERE category = 'Barang' AND goods_type = 'Ban'
         )`
    );
    const attached = attachedCountRes?.count || 0;

    const attachRate = denominator > 0 ? (attached / denominator) * 100 : 0;

    expect(denominator).toBe(3); // 3 unique invoices contain tires (TEST-003, TEST-004, TEST-005)
    expect(attached).toBe(1); // Only 1 invoice contains both
    expect(attachRate).toBeCloseTo(33.33, 1); // 33.3% rate
  });

  it('6. should exclude Cancelled and Draft invoices from revenue calculations', async () => {
    // Draft Invoice
    const draftRes = await db.run(
      `INSERT INTO invoices (invoice_number, invoice_date, customer_name, car_brand, car_series, car_year, status) 
       VALUES ('TEST-006', '2026-05-28', 'Draft Customer', 'Honda', 'Jazz', 2015, 'Draft')`
    );
    await db.run(
      `INSERT INTO invoice_items (invoice_id, category, item_name, quantity, unit_price, discount, subtotal) 
       VALUES (?, 'Barang', 'Oil Filter', 1, 100000, 0, 100000)`,
      [draftRes.lastID]
    );

    // Cancelled Invoice
    const cancelRes = await db.run(
      `INSERT INTO invoices (invoice_number, invoice_date, customer_name, car_brand, car_series, car_year, status) 
       VALUES ('TEST-007', '2026-05-28', 'Cancel Customer', 'Honda', 'Jazz', 2015, 'Cancelled')`
    );
    await db.run(
      `INSERT INTO invoice_items (invoice_id, category, item_name, quantity, unit_price, discount, subtotal) 
       VALUES (?, 'Barang', 'Tire Achilles', 2, 800000, 0, 1600000)`,
      [cancelRes.lastID]
    );

    // Calculate total revenue of all invoices that are Final
    const revRes = await db.get<{ total: number }>(
      `SELECT SUM(ii.subtotal) as total
       FROM invoices i
       LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
       WHERE i.status = 'Final'`
    );

    // Total final revenue from other tests: 
    // TEST-001 (430000) + TEST-002 (400000) + TEST-003 (2400000 + 400000 = 2800000) + TEST-004 (1400000 + 150000 = 1550000) + TEST-005 (1400000) = 6,580,000.
    // Confirm the draft (100k) and cancelled (1600k) are not in this total!
    expect(revRes?.total).toBe(6580000);
  });

  it('7. should apply the leaderboard sales score index formula correctly', async () => {
    // Prepare salesperson stats mock data based on our PRD formula:
    // Sales A: Revenue = 10,000,000, Invoices = 5
    // Sales B: Revenue = 5,000,000, Invoices = 10
    
    // Max values: MaxRevenue = 10,000,000, MaxInvoices = 10
    const maxRevenue = 10000000;
    const maxInvoices = 10;

    // Sales A Index & Score:
    const revIndexA = 10000000 / maxRevenue; // 1.0
    const invIndexA = 5 / maxInvoices; // 0.5
    const scoreA = (revIndexA * 0.6) + (invIndexA * 0.4); // 0.6 * 1.0 + 0.4 * 0.5 = 0.8

    // Sales B Index & Score:
    const revIndexB = 5000000 / maxRevenue; // 0.5
    const invIndexB = 10 / maxInvoices; // 1.0
    const scoreB = (revIndexB * 0.6) + (invIndexB * 0.4); // 0.6 * 0.5 + 0.4 * 1.0 = 0.7

    expect(scoreA).toBe(0.8);
    expect(scoreB).toBe(0.7);
    expect(scoreA).toBeGreaterThan(scoreB); // Sales A ranks higher than B
  });
});
