import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../database.sqlite');

export interface DbWrapper {
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  all<T = any>(sql: string, params?: any[]): Promise<T[]>;
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
  exec(sql: string): Promise<void>;
  prepare(sql: string): Promise<{
    run(...params: any[]): Promise<void>;
    finalize(): Promise<void>;
  }>;
}

// Translate SQLite query dialect to PostgreSQL
function translateSql(sql: string): string {
  let translated = sql;

  // 1. Translate SQLite specific INSERT OR IGNORE
  if (translated.includes('INSERT OR IGNORE')) {
    translated = translated.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');
    if (translated.includes('master_data')) {
      translated += ' ON CONFLICT (category, value) DO NOTHING';
    }
  }

  // 2. Translate SQLite parameter placeholders (?) to PostgreSQL ($1, $2, ...)
  let index = 1;
  translated = translated.replace(/\?/g, () => `$${index++}`);

  return translated;
}

// 1. PostgreSQL Adapter
class PgAdapter implements DbWrapper {
  private pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    const translated = translateSql(sql);
    const res = await this.pool.query(translated, params);
    return res.rows[0] as T | undefined;
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const translated = translateSql(sql);
    const res = await this.pool.query(translated, params);
    return res.rows as T[];
  }

  async run(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    let querySql = sql;
    const isInsert = querySql.trim().toUpperCase().startsWith('INSERT INTO');
    if (isInsert && !querySql.toUpperCase().includes('RETURNING')) {
      querySql += ' RETURNING id';
    }
    const translated = translateSql(querySql);
    const res = await this.pool.query(translated, params);
    return {
      lastID: isInsert && res.rows[0]?.id ? Number(res.rows[0].id) : undefined,
      changes: res.rowCount || 0
    };
  }

  async exec(sql: string): Promise<void> {
    // Run multiple statement schema queries sequentially in postgres
    // Split on semicolons but ignore inside strings
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const stmt of statements) {
      await this.pool.query(stmt);
    }
  }

  async prepare(sql: string) {
    let querySql = sql;
    const isInsert = querySql.trim().toUpperCase().startsWith('INSERT INTO');
    if (isInsert && !querySql.toUpperCase().includes('RETURNING')) {
      querySql += ' RETURNING id';
    }
    const translated = translateSql(querySql);
    const pool = this.pool;
    return {
      async run(...params: any[]) {
        await pool.query(translated, params);
      },
      async finalize() {
        // No-op for postgres
      }
    };
  }
}

// 2. SQLite Adapter
class SqliteAdapter implements DbWrapper {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return this.db.get<T>(sql, params);
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return this.db.all<T[]>(sql, params);
  }

  async run(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    const res = await this.db.run(sql, params);
    return {
      lastID: res.lastID,
      changes: res.changes
    };
  }

  async exec(sql: string): Promise<void> {
    await this.db.exec(sql);
  }

  async prepare(sql: string) {
    const stmt = await this.db.prepare(sql);
    return {
      async run(...params: any[]) {
        await stmt.run(...params);
      },
      async finalize() {
        await stmt.finalize();
      }
    };
  }
}

let dbInstance: DbWrapper | null = null;

export async function getDb(): Promise<DbWrapper> {
  if (dbInstance) return dbInstance;

  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    console.log('Connecting to Supabase PostgreSQL Database...');
    // Strip sslmode=require if present to prevent pg from overriding rejectUnauthorized
    const cleanConnectionString = connectionString.replace(/[&?]sslmode=require/gi, '');
    const pool = new pg.Pool({
      connectionString: cleanConnectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });

    dbInstance = new PgAdapter(pool);

    // Initialize Schema
    const SCHEMA_PATH = path.join(__dirname, 'schema_pg.sql');
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    await dbInstance.exec(schema);

    // Auto-seed
    await seedDatabase(dbInstance);
  } else {
    console.log('Connecting to local SQLite Database...');
    // Ensure directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const sqliteDb = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    // Enable foreign keys
    await sqliteDb.run('PRAGMA foreign_keys = ON');

    dbInstance = new SqliteAdapter(sqliteDb);

    // Initialize Schema
    const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    await dbInstance.exec(schema);

    // Auto-seed
    await seedDatabase(dbInstance);
  }

  return dbInstance;
}

// Auto-seed Master Data and Sample Transactions
async function seedDatabase(db: DbWrapper) {
  // Check if master data is already populated
  const masterCount = await db.get<{ count: string | number }>('SELECT COUNT(*) as count FROM master_data');
  const countNum = masterCount ? Number(masterCount.count) : 0;
  
  if (countNum === 0) {
    console.log('Seeding master data...');
    const seedValues: { category: string; value: string }[] = [
      // Sales
      { category: 'sales', value: 'Budi' },
      { category: 'sales', value: 'Andi' },
      { category: 'sales', value: 'Siti' },
      { category: 'sales', value: 'Eko' },
      // Car brands
      { category: 'car_brand', value: 'Toyota' },
      { category: 'car_brand', value: 'Honda' },
      { category: 'car_brand', value: 'Suzuki' },
      { category: 'car_brand', value: 'Mitsubishi' },
      { category: 'car_brand', value: 'Daihatsu' },
      { category: 'car_brand', value: 'Nissan' },
      // Car series
      { category: 'car_series', value: 'Avanza' },
      { category: 'car_series', value: 'Innova' },
      { category: 'car_series', value: 'Fortuner' },
      { category: 'car_series', value: 'Civic' },
      { category: 'car_series', value: 'Brio' },
      { category: 'car_series', value: 'Jazz' },
      { category: 'car_series', value: 'Ertiga' },
      { category: 'car_series', value: 'Xpander' },
      { category: 'car_series', value: 'Xenia' },
      // Service types
      { category: 'service_type', value: 'Spooring' },
      { category: 'service_type', value: 'Balancing' },
      { category: 'service_type', value: 'Finish Balance' },
      { category: 'service_type', value: 'Service Rem' },
      { category: 'service_type', value: 'Isi Nitrogen' },
      { category: 'service_type', value: 'Selep Diskbrake' },
      // Goods types
      { category: 'goods_type', value: 'Ban' },
      { category: 'goods_type', value: 'Oli' },
      { category: 'goods_type', value: 'Chemical' },
      { category: 'goods_type', value: 'Lainnya' },
      // Tire brands
      { category: 'tire_brand', value: 'Bridgestone' },
      { category: 'tire_brand', value: 'Dunlop' },
      { category: 'tire_brand', value: 'Michelin' },
      { category: 'tire_brand', value: 'Gajah Tunggal' },
      { category: 'tire_brand', value: 'Achilles' },
      { category: 'tire_brand', value: 'Falken' },
      // Tire sizes
      { category: 'tire_size', value: '185/70 R14' },
      { category: 'tire_size', value: '195/65 R15' },
      { category: 'tire_size', value: '205/65 R16' },
      { category: 'tire_size', value: '215/65 R16' },
      { category: 'tire_size', value: '225/60 R17' },
      { category: 'tire_size', value: '265/65 R17' },
      // Understeel parts
      { category: 'understeel_part', value: 'Tierod End' },
      { category: 'understeel_part', value: 'Long Tierod' },
      { category: 'understeel_part', value: 'Ball Joint' },
      { category: 'understeel_part', value: 'Link Stabilizer' },
      { category: 'understeel_part', value: 'Bushing Arm' },
      { category: 'understeel_part', value: 'Shockbreaker' },
      // Part positions
      { category: 'part_position', value: 'Depan' },
      { category: 'part_position', value: 'Belakang' },
      { category: 'part_position', value: 'Kiri' },
      { category: 'part_position', value: 'Kanan' },
      { category: 'part_position', value: 'Set' },
      { category: 'part_position', value: 'Depan Kiri' },
      { category: 'part_position', value: 'Depan Kanan' },
      { category: 'part_position', value: 'Belakang Kiri' },
      { category: 'part_position', value: 'Belakang Kanan' }
    ];

    const stmt = await db.prepare('INSERT OR IGNORE INTO master_data (category, value) VALUES (?, ?)');
    for (const item of seedValues) {
      await stmt.run(item.category, item.value);
    }
    await stmt.finalize();
  }

  // Check if sample invoices exist
  const invoiceCount = await db.get<{ count: string | number }>('SELECT COUNT(*) as count FROM invoices');
  const invCountNum = invoiceCount ? Number(invoiceCount.count) : 0;
  if (invCountNum === 0) {
    console.log('Seeding sample transactions...');
    
    // Helper to get dates relative to today
    const getDateDaysAgo = (days: number): string => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString().split('T')[0];
    };

    const sampleInvoices = [
      {
        invoice_number: 'INV-2026-001',
        invoice_date: getDateDaysAgo(25),
        customer_name: 'Hendra Wijaya',
        car_brand: 'Toyota',
        car_series: 'Avanza',
        car_year: 2018,
        notes: 'Pemasangan ban baru depan kiri & kanan, spooring balancing lengkap.',
        sales_person: 'Budi',
        status: 'Final',
        items: [
          {
            category: 'Barang',
            item_name: 'Bridgestone Ecopia 185/70 R14',
            quantity: 2,
            unit_price: 750000,
            discount: 50000,
            subtotal: 1400000,
            sales_person: 'Budi',
            goods_type: 'Ban',
            goods_brand: 'Bridgestone',
            tire_brand: 'Bridgestone',
            tire_size: '185/70 R14',
            tire_pattern: 'Ecopia',
            tire_position: 'Depan'
          },
          {
            category: 'Jasa',
            item_name: 'Spooring 3D',
            quantity: 1,
            unit_price: 150000,
            discount: 0,
            subtotal: 150000,
            sales_person: 'Budi',
            service_type: 'Spooring',
            technician: 'Slamet'
          },
          {
            category: 'Jasa',
            item_name: 'Balancing Roda',
            quantity: 2,
            unit_price: 25000,
            discount: 0,
            subtotal: 50000,
            sales_person: 'Budi',
            service_type: 'Balancing',
            technician: 'Slamet'
          }
        ]
      },
      {
        invoice_number: 'INV-2026-002',
        invoice_date: getDateDaysAgo(20),
        customer_name: 'Dewi Rahmawati',
        car_brand: 'Honda',
        car_series: 'Brio',
        car_year: 2021,
        notes: 'Ganti ban belakang 2 biji.',
        sales_person: 'Andi',
        status: 'Final',
        items: [
          {
            category: 'Barang',
            item_name: 'Dunlop Enasave 185/70 R14',
            quantity: 2,
            unit_price: 680000,
            discount: 20000,
            subtotal: 1320000,
            sales_person: 'Andi',
            goods_type: 'Ban',
            goods_brand: 'Dunlop',
            tire_brand: 'Dunlop',
            tire_size: '185/70 R14',
            tire_pattern: 'Enasave',
            tire_position: 'Belakang'
          },
          {
            category: 'Jasa',
            item_name: 'Balancing Roda',
            quantity: 2,
            unit_price: 25000,
            discount: 0,
            subtotal: 50000,
            sales_person: 'Andi',
            service_type: 'Balancing',
            technician: 'Nardi'
          }
        ]
      },
      {
        invoice_number: 'INV-2026-003',
        invoice_date: getDateDaysAgo(15),
        customer_name: 'Rian Hidayat',
        car_brand: 'Toyota',
        car_series: 'Innova',
        car_year: 2019,
        notes: 'Keluhan setir getar dan bunyi gluduk-gluduk. Ternyata long tierod oblak.',
        sales_person: 'Siti',
        status: 'Final',
        items: [
          {
            category: 'Understeel',
            item_name: 'Long Tierod Toyota Innova 555',
            quantity: 2,
            unit_price: 320000,
            discount: 0,
            subtotal: 640000,
            sales_person: 'Siti',
            part_brand: '555',
            part_position: 'Depan Kiri & Kanan'
          },
          {
            category: 'Jasa',
            item_name: 'Service Rem Set',
            quantity: 1,
            unit_price: 100000,
            discount: 10000,
            subtotal: 90000,
            sales_person: 'Siti',
            service_type: 'Service Rem',
            technician: 'Agus'
          },
          {
            category: 'Jasa',
            item_name: 'Spooring 3D',
            quantity: 1,
            unit_price: 150000,
            discount: 0,
            subtotal: 150000,
            sales_person: 'Siti',
            service_type: 'Spooring',
            technician: 'Agus'
          }
        ]
      },
      {
        invoice_number: 'INV-2026-004',
        invoice_date: getDateDaysAgo(10),
        customer_name: 'Anto Prasetyo',
        car_brand: 'Suzuki',
        car_series: 'Ertiga',
        car_year: 2017,
        notes: 'Beli Ban 4 biji + Long Tierod + Spooring Balancing lengkap.',
        sales_person: 'Budi',
        status: 'Final',
        items: [
          {
            category: 'Barang',
            item_name: 'Gajah Tunggal Champiro 185/70 R14',
            quantity: 4,
            unit_price: 520000,
            discount: 20000,
            subtotal: 2000000,
            sales_person: 'Budi',
            goods_type: 'Ban',
            goods_brand: 'Gajah Tunggal',
            tire_brand: 'Gajah Tunggal',
            tire_size: '185/70 R14',
            tire_pattern: 'Champiro Ecotec',
            tire_position: 'Set'
          },
          {
            category: 'Understeel',
            item_name: 'Long Tierod Suzuki Ertiga SGP',
            quantity: 2,
            unit_price: 280000,
            discount: 30000,
            subtotal: 500000,
            sales_person: 'Budi',
            part_brand: 'SGP',
            part_position: 'Depan Kiri & Kanan'
          },
          {
            category: 'Jasa',
            item_name: 'Spooring 3D',
            quantity: 1,
            unit_price: 150000,
            discount: 0,
            subtotal: 150000,
            sales_person: 'Budi',
            service_type: 'Spooring',
            technician: 'Slamet'
          },
          {
            category: 'Jasa',
            item_name: 'Balancing Roda',
            quantity: 4,
            unit_price: 25000,
            discount: 0,
            subtotal: 100000,
            sales_person: 'Budi',
            service_type: 'Balancing',
            technician: 'Slamet'
          }
        ]
      },
      {
        invoice_number: 'INV-2026-005',
        invoice_date: getDateDaysAgo(6),
        customer_name: 'Lina Marlina',
        car_brand: 'Mitsubishi',
        car_series: 'Xpander',
        car_year: 2020,
        notes: 'Servis berkala ganti oli mesin.',
        sales_person: 'Eko',
        status: 'Final',
        items: [
          {
            category: 'Barang',
            item_name: 'Oli Shell Helix HX8 5W-30 4L',
            quantity: 1,
            unit_price: 450000,
            discount: 0,
            subtotal: 450000,
            sales_person: 'Eko',
            goods_type: 'Oli',
            goods_brand: 'Shell'
          },
          {
            category: 'Jasa',
            item_name: 'Jasa Ganti Oli',
            quantity: 1,
            unit_price: 50000,
            discount: 0,
            subtotal: 50000,
            sales_person: 'Eko',
            service_type: 'Service Rem',
            technician: 'Agus'
          }
        ]
      },
      {
        invoice_number: 'INV-2026-006',
        invoice_date: getDateDaysAgo(3),
        customer_name: 'Joko Widodo',
        car_brand: 'Toyota',
        car_series: 'Fortuner',
        car_year: 2021,
        notes: 'Ban besar 4 biji + Spooring Balancing + Nitrogen.',
        sales_person: 'Andi',
        status: 'Final',
        items: [
          {
            category: 'Barang',
            item_name: 'Bridgestone Dueler H/T 265/65 R17',
            quantity: 4,
            unit_price: 1850000,
            discount: 100000,
            subtotal: 7000000,
            sales_person: 'Andi',
            goods_type: 'Ban',
            goods_brand: 'Bridgestone',
            tire_brand: 'Bridgestone',
            tire_size: '265/65 R17',
            tire_pattern: 'Dueler HT',
            tire_position: 'Set'
          },
          {
            category: 'Jasa',
            item_name: 'Spooring 3D SUV',
            quantity: 1,
            unit_price: 200000,
            discount: 0,
            subtotal: 200000,
            sales_person: 'Andi',
            service_type: 'Spooring',
            technician: 'Nardi'
          },
          {
            category: 'Jasa',
            item_name: 'Balancing Roda',
            quantity: 4,
            unit_price: 30000,
            discount: 0,
            subtotal: 120000,
            sales_person: 'Andi',
            service_type: 'Balancing',
            technician: 'Nardi'
          },
          {
            category: 'Jasa',
            item_name: 'Isi Nitrogen Set',
            quantity: 1,
            unit_price: 20000,
            discount: 0,
            subtotal: 20000,
            sales_person: 'Andi',
            service_type: 'Isi Nitrogen',
            technician: 'Nardi'
          }
        ]
      },
      {
        invoice_number: 'INV-2026-007',
        invoice_date: getDateDaysAgo(2),
        customer_name: 'Wulan Sari',
        car_brand: 'Honda',
        car_series: 'Civic',
        car_year: 2022,
        notes: 'Spooring balancing berkala.',
        sales_person: 'Siti',
        status: 'Final',
        items: [
          {
            category: 'Jasa',
            item_name: 'Spooring Sedan',
            quantity: 1,
            unit_price: 150000,
            discount: 0,
            subtotal: 150000,
            sales_person: 'Siti',
            service_type: 'Spooring',
            technician: 'Agus'
          },
          {
            category: 'Jasa',
            item_name: 'Balancing Sedan',
            quantity: 2,
            unit_price: 25000,
            discount: 0,
            subtotal: 50000,
            sales_person: 'Siti',
            service_type: 'Balancing',
            technician: 'Agus'
          }
        ]
      },
      {
        invoice_number: 'INV-2026-008',
        invoice_date: getDateDaysAgo(1),
        customer_name: 'Rudi Tabuti',
        car_brand: 'Toyota',
        car_series: 'Avanza',
        car_year: 2015,
        notes: 'DRAFT: Rencana ganti ban belakang besok.',
        sales_person: 'Budi',
        status: 'Draft',
        items: [
          {
            category: 'Barang',
            item_name: 'Bridgestone Ecopia 185/70 R14',
            quantity: 2,
            unit_price: 750000,
            discount: 0,
            subtotal: 1500000,
            sales_person: 'Budi',
            goods_type: 'Ban',
            goods_brand: 'Bridgestone',
            tire_brand: 'Bridgestone',
            tire_size: '185/70 R14',
            tire_pattern: 'Ecopia',
            tire_position: 'Belakang'
          }
        ]
      },
      {
        invoice_number: 'INV-2026-009',
        invoice_date: getDateDaysAgo(12),
        customer_name: 'Sari Puspita',
        car_brand: 'Daihatsu',
        car_series: 'Xenia',
        car_year: 2018,
        notes: 'CANCELLED: Batal transaksi karena stok ban Michelin kosong.',
        sales_person: 'Andi',
        status: 'Cancelled',
        items: [
          {
            category: 'Barang',
            item_name: 'Michelin Energy XM2 185/70 R14',
            quantity: 2,
            unit_price: 900000,
            discount: 0,
            subtotal: 1800000,
            sales_person: 'Andi',
            goods_type: 'Ban',
            goods_brand: 'Michelin',
            tire_brand: 'Michelin',
            tire_size: '185/70 R14',
            tire_pattern: 'XM2',
            tire_position: 'Depan'
          }
        ]
      }
    ];

    for (const inv of sampleInvoices) {
      // 1. Insert header
      const headerRes = await db.run(
        `INSERT INTO invoices (invoice_number, invoice_date, customer_name, car_brand, car_series, car_year, notes, sales_person, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inv.invoice_number,
          inv.invoice_date,
          inv.customer_name,
          inv.car_brand,
          inv.car_series,
          inv.car_year,
          inv.notes,
          inv.sales_person,
          inv.status
        ]
      );
      
      const invoiceId = headerRes.lastID;
      if (!invoiceId) continue;

      // 2. Insert items
      for (const item of inv.items) {
        await db.run(
          `INSERT INTO invoice_items (
            invoice_id, category, item_name, quantity, unit_price, discount, subtotal, sales_person, notes,
            goods_type, goods_brand, tire_brand, tire_size, tire_pattern, tire_position,
            service_type, technician, part_brand, part_position
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceId,
            item.category,
            item.item_name,
            item.quantity,
            item.unit_price,
            item.discount || 0,
            item.subtotal,
            item.sales_person || inv.sales_person,
            (item as any).notes || null,
            (item as any).goods_type || null,
            (item as any).goods_brand || null,
            (item as any).tire_brand || null,
            (item as any).tire_size || null,
            (item as any).tire_pattern || null,
            (item as any).tire_position || null,
            (item as any).service_type || null,
            (item as any).technician || null,
            (item as any).part_brand || null,
            (item as any).part_position || null
          ]
        );
      }
    }
    
    console.log('Seeded sample transactions successfully.');
  }
}
