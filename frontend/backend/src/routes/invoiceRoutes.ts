import { Router, Request, Response } from 'express';
import { getDb } from '../db/db.js';

const router = Router();

// Validation helper
function validateInvoice(body: any) {
  const {
    invoice_number,
    invoice_date,
    customer_name,
    car_brand,
    car_series,
    car_year,
    status = 'Draft',
    items = []
  } = body;

  const errors: string[] = [];

  if (!invoice_number || typeof invoice_number !== 'string' || invoice_number.trim() === '') {
    errors.push('Nomor invoice wajib diisi.');
  }
  if (!invoice_date) {
    errors.push('Tanggal invoice wajib diisi.');
  }
  if (!customer_name || typeof customer_name !== 'string' || customer_name.trim() === '') {
    errors.push('Nama pelanggan wajib diisi.');
  }
  if (!car_brand || typeof car_brand !== 'string' || car_brand.trim() === '') {
    errors.push('Merek mobil wajib diisi.');
  }
  if (!car_series || typeof car_series !== 'string' || car_series.trim() === '') {
    errors.push('Series mobil wajib diisi.');
  }
  if (car_year === undefined || car_year === null || isNaN(Number(car_year))) {
    errors.push('Tahun mobil wajib diisi dan berupa angka.');
  }

  if (status === 'Final' && (!items || items.length === 0)) {
    errors.push('Invoice dengan status Final harus memiliki minimal satu item.');
  }

  if (items && items.length > 0) {
    items.forEach((item: any, idx: number) => {
      const prefix = `Item #${idx + 1}: `;
      
      if (!item.category || !['Barang', 'Jasa', 'Understeel'].includes(item.category)) {
        errors.push(`${prefix}Kategori harus Barang, Jasa, atau Understeel.`);
      }
      if (!item.item_name || item.item_name.trim() === '') {
        errors.push(`${prefix}Nama item/jasa/part wajib diisi.`);
      }
      if (item.quantity === undefined || item.quantity === null || Number(item.quantity) <= 0) {
        errors.push(`${prefix}Jumlah (quantity) harus lebih besar dari 0.`);
      }
      if (item.unit_price === undefined || item.unit_price === null || Number(item.unit_price) < 0) {
        errors.push(`${prefix}Harga satuan tidak boleh negatif.`);
      }

      // Category specific validation
      if (item.category === 'Barang') {
        if (!item.goods_type || !['Ban', 'Oli', 'Chemical', 'Lainnya'].includes(item.goods_type)) {
          errors.push(`${prefix}Jenis barang harus Ban, Oli, Chemical, atau Lainnya.`);
        }
        if (item.goods_type === 'Ban') {
          if (!item.tire_brand || item.tire_brand.trim() === '') {
            errors.push(`${prefix}Merek ban wajib diisi untuk barang berjenis Ban.`);
          }
          if (!item.tire_size || item.tire_size.trim() === '') {
            errors.push(`${prefix}Ukuran ban wajib diisi untuk barang berjenis Ban.`);
          }
        }
      } else if (item.category === 'Jasa') {
        if (!item.service_type || item.service_type.trim() === '') {
          errors.push(`${prefix}Tipe layanan jasa wajib diisi.`);
        }
      } else if (item.category === 'Understeel') {
        if (!item.part_position || item.part_position.trim() === '') {
          errors.push(`${prefix}Posisi part understeel wajib diisi.`);
        }
      }
    });
  }

  return errors;
}

// 1. CREATE Invoice
router.post('/', async (req: Request, res: Response) => {
  const db = await getDb();
  const errors = validateInvoice(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const {
    invoice_number,
    invoice_date,
    customer_name,
    car_brand,
    car_series,
    car_year,
    notes = null,
    sales_person = null,
    status = 'Draft',
    items = []
  } = req.body;

  try {
    // Check invoice number uniqueness
    const existing = await db.get('SELECT id FROM invoices WHERE invoice_number = ?', [invoice_number]);
    if (existing) {
      return res.status(400).json({ success: false, errors: ['Nomor invoice sudah digunakan. Harap gunakan nomor lain.'] });
    }

    // Start transaction
    await db.run('BEGIN TRANSACTION');

    const result = await db.run(
      `INSERT INTO invoices (invoice_number, invoice_date, customer_name, car_brand, car_series, car_year, notes, sales_person, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoice_number, invoice_date, customer_name, car_brand, car_series, Number(car_year), notes, sales_person, status]
    );

    const invoiceId = result.lastID;

    if (invoiceId) {
      for (const item of items) {
        const qty = Number(item.quantity);
        const price = Number(item.unit_price);
        const disc = Number(item.discount || 0);
        const subtotal = qty * price - disc;

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
            qty,
            price,
            disc,
            subtotal,
            item.sales_person || sales_person,
            item.notes || null,
            item.goods_type || null,
            item.goods_brand || null,
            item.tire_brand || null,
            item.tire_size || null,
            item.tire_pattern || null,
            item.tire_position || null,
            item.service_type || null,
            item.technician || null,
            item.part_brand || null,
            item.part_position || null
          ]
        );

        // Dynamically add to master_data to keep autocomplete updated
        const toSeedMaster: { category: string; value: string }[] = [];
        if (sales_person) toSeedMaster.push({ category: 'sales', value: sales_person });
        if (item.sales_person) toSeedMaster.push({ category: 'sales', value: item.sales_person });
        if (car_brand) toSeedMaster.push({ category: 'car_brand', value: car_brand });
        if (car_series) toSeedMaster.push({ category: 'car_series', value: car_series });
        if (item.category === 'Barang') {
          toSeedMaster.push({ category: 'goods_type', value: item.goods_type });
          if (item.goods_type === 'Ban') {
            if (item.tire_brand) toSeedMaster.push({ category: 'tire_brand', value: item.tire_brand });
            if (item.tire_size) toSeedMaster.push({ category: 'tire_size', value: item.tire_size });
          }
        } else if (item.category === 'Jasa') {
          if (item.service_type) toSeedMaster.push({ category: 'service_type', value: item.service_type });
        } else if (item.category === 'Understeel') {
          if (item.item_name) toSeedMaster.push({ category: 'understeel_part', value: item.item_name });
          if (item.part_position) toSeedMaster.push({ category: 'part_position', value: item.part_position });
        }

        for (const master of toSeedMaster) {
          if (master.value && master.value.trim() !== '') {
            await db.run(
              'INSERT OR IGNORE INTO master_data (category, value) VALUES (?, ?)',
              [master.category, master.value.trim()]
            );
          }
        }
      }
    }

    await db.run('COMMIT');
    res.status(201).json({ success: true, invoiceId });
  } catch (err: any) {
    await db.run('ROLLBACK');
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

// 2. UPDATE Invoice
router.put('/:id', async (req: Request, res: Response) => {
  const db = await getDb();
  const invoiceId = Number(req.params.id);
  const errors = validateInvoice(req.body);

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const {
    invoice_number,
    invoice_date,
    customer_name,
    car_brand,
    car_series,
    car_year,
    notes = null,
    sales_person = null,
    status = 'Draft',
    items = []
  } = req.body;

  try {
    const existingInvoice = await db.get('SELECT id, status FROM invoices WHERE id = ?', [invoiceId]);
    if (!existingInvoice) {
      return res.status(404).json({ success: false, errors: ['Invoice tidak ditemukan.'] });
    }

    // Check invoice number uniqueness if changed
    const duplicate = await db.get('SELECT id FROM invoices WHERE invoice_number = ? AND id != ?', [invoice_number, invoiceId]);
    if (duplicate) {
      return res.status(400).json({ success: false, errors: ['Nomor invoice sudah digunakan oleh invoice lain.'] });
    }

    await db.run('BEGIN TRANSACTION');

    // Update Header
    await db.run(
      `UPDATE invoices 
       SET invoice_number = ?, invoice_date = ?, customer_name = ?, car_brand = ?, car_series = ?, car_year = ?, notes = ?, sales_person = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [invoice_number, invoice_date, customer_name, car_brand, car_series, Number(car_year), notes, sales_person, status, invoiceId]
    );

    // Delete old items
    await db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

    // Insert new items
    for (const item of items) {
      const qty = Number(item.quantity);
      const price = Number(item.unit_price);
      const disc = Number(item.discount || 0);
      const subtotal = qty * price - disc;

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
          qty,
          price,
          disc,
          subtotal,
          item.sales_person || sales_person,
          item.notes || null,
          item.goods_type || null,
          item.goods_brand || null,
          item.tire_brand || null,
          item.tire_size || null,
          item.tire_pattern || null,
          item.tire_position || null,
          item.service_type || null,
          item.technician || null,
          item.part_brand || null,
          item.part_position || null
        ]
      );

      // Autocomplete master data update
      const toSeedMaster: { category: string; value: string }[] = [];
      if (sales_person) toSeedMaster.push({ category: 'sales', value: sales_person });
      if (item.sales_person) toSeedMaster.push({ category: 'sales', value: item.sales_person });
      if (car_brand) toSeedMaster.push({ category: 'car_brand', value: car_brand });
      if (car_series) toSeedMaster.push({ category: 'car_series', value: car_series });
      if (item.category === 'Barang') {
        toSeedMaster.push({ category: 'goods_type', value: item.goods_type });
        if (item.goods_type === 'Ban') {
          if (item.tire_brand) toSeedMaster.push({ category: 'tire_brand', value: item.tire_brand });
          if (item.tire_size) toSeedMaster.push({ category: 'tire_size', value: item.tire_size });
        }
      } else if (item.category === 'Jasa') {
        if (item.service_type) toSeedMaster.push({ category: 'service_type', value: item.service_type });
      } else if (item.category === 'Understeel') {
        if (item.item_name) toSeedMaster.push({ category: 'understeel_part', value: item.item_name });
        if (item.part_position) toSeedMaster.push({ category: 'part_position', value: item.part_position });
      }

      for (const master of toSeedMaster) {
        if (master.value && master.value.trim() !== '') {
          await db.run(
            'INSERT OR IGNORE INTO master_data (category, value) VALUES (?, ?)',
            [master.category, master.value.trim()]
          );
        }
      }
    }

    await db.run('COMMIT');
    res.json({ success: true, invoiceId });
  } catch (err: any) {
    await db.run('ROLLBACK');
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

// 3. GET ALL Invoices (History with pagination, search, filters)
router.get('/', async (req: Request, res: Response) => {
  const db = await getDb();
  
  // Filters
  const search = req.query.search ? `%${req.query.search}%` : null;
  const status = req.query.status as string;
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const salesPerson = req.query.salesPerson as string;
  const category = req.query.category as string;
  
  // Pagination
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Number(req.query.limit || 15));
  const offset = (page - 1) * limit;

  let query = `
    SELECT DISTINCT i.*, 
           (SELECT SUM(subtotal) FROM invoice_items WHERE invoice_id = i.id) as total_amount
    FROM invoices i
    LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    query += ` AND (i.invoice_number LIKE ? OR i.customer_name LIKE ? OR i.car_brand LIKE ? OR i.car_series LIKE ?)`;
    params.push(search, search, search, search);
  }

  if (status) {
    query += ` AND i.status = ?`;
    params.push(status);
  }

  if (startDate) {
    query += ` AND i.invoice_date >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND i.invoice_date <= ?`;
    params.push(endDate);
  }

  if (salesPerson) {
    query += ` AND (i.sales_person = ? OR ii.sales_person = ?)`;
    params.push(salesPerson, salesPerson);
  }

  if (category) {
    query += ` AND ii.category = ?`;
    params.push(category);
  }

  // Count total matching items
  const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
  
  // Order & Pagination
  query += ` ORDER BY i.invoice_date DESC, i.invoice_number DESC LIMIT ? OFFSET ?`;
  const pagedParams = [...params, limit, offset];

  try {
    const totalResult = await db.get<{ total: number }>(countQuery, params);
    const totalItems = totalResult ? totalResult.total : 0;
    const totalPages = Math.ceil(totalItems / limit);

    const invoices = await db.all(query, pagedParams);

    res.json({
      success: true,
      invoices,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

// 4. GET SINGLE Invoice
router.get('/:id', async (req: Request, res: Response) => {
  const db = await getDb();
  const id = Number(req.params.id);

  try {
    const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!invoice) {
      return res.status(404).json({ success: false, errors: ['Invoice tidak ditemukan.'] });
    }

    const items = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [id]);
    res.json({
      success: true,
      invoice: {
        ...invoice,
        items
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

// 5. CANCEL Invoice
router.post('/:id/cancel', async (req: Request, res: Response) => {
  const db = await getDb();
  const id = Number(req.params.id);

  try {
    const invoice = await db.get('SELECT id, status FROM invoices WHERE id = ?', [id]);
    if (!invoice) {
      return res.status(404).json({ success: false, errors: ['Invoice tidak ditemukan.'] });
    }

    await db.run('UPDATE invoices SET status = "Cancelled", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    res.json({ success: true, message: 'Invoice berhasil dibatalkan.' });
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

// Helper functions for CSV Parsing
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function parseIndoNumber(str: string): number {
  if (!str || str.trim() === '0' || str.trim() === '') return 0;
  const clean = str.replace(/\./g, '');
  const num = Number(clean);
  return isNaN(num) ? 0 : num;
}

function parseTireSize(detail: string): string {
  const sizePattern3 = /(\d{3})\s+(\d{2})\s+(\d{2})/;
  const match3 = detail.match(sizePattern3);
  if (match3) {
    return `${match3[1]}/${match3[2]} R${match3[3]}`;
  }
  const sizePattern2 = /(\d{3})\s+(\d{2})/;
  const match2 = detail.match(sizePattern2);
  if (match2) {
    return `${match2[1]} R${match2[2]}`;
  }
  const rPattern = /R\s*(\d{2})/i;
  const rMatch = detail.match(rPattern);
  if (rMatch) {
    return `R${rMatch[1]}`;
  }
  return '185/70 R14';
}

function parseTireBrand(detail: string): string {
  const upper = detail.toUpperCase();
  if (upper.includes('GT') || upper.includes('CHAMPIRO') || upper.includes('GAJAH TUNGGAL')) return 'Gajah Tunggal';
  if (upper.includes('BRIDGESTONE') || upper.includes('BS') || upper.includes('ECOPIA') || upper.includes('TURANZA')) return 'Bridgestone';
  if (upper.includes('DUNLOP') || upper.includes('ENASAVE')) return 'Dunlop';
  if (upper.includes('MICHELIN') || upper.includes('XM2')) return 'Michelin';
  if (upper.includes('ACHILLES')) return 'Achilles';
  if (upper.includes('LAUFENN')) return 'Laufenn';
  if (upper.includes('FALKEN')) return 'Falken';
  
  const firstWord = detail.split(' ')[0];
  if (firstWord && firstWord.length > 2) return toTitleCase(firstWord);
  return 'Lainnya';
}

// 6. UPLOAD & IMPORT CSV
router.post('/import-csv', async (req: Request, res: Response) => {
  const db = await getDb();
  const { csvContent, mode = 'append' } = req.body;

  if (!csvContent || typeof csvContent !== 'string') {
    return res.status(400).json({ success: false, errors: ['Konten CSV tidak boleh kosong.'] });
  }

  const lines = csvContent.split(/\r?\n/);
  if (lines.length < 2) {
    return res.status(400).json({ success: false, errors: ['CSV minimal harus memiliki satu baris header dan satu baris data.'] });
  }

  try {
    const invoicesMap = new Map<string, {
      invoice_date: string;
      customer_name: string;
      car_brand: string;
      car_series: string;
      car_year: number;
      sales_person: string;
      items: any[];
    }>();

    const masterSales = new Set<string>();
    const masterCarBrands = new Set<string>();
    const masterCarSeries = new Set<string>();
    const masterServiceTypes = new Set<string>();
    const masterGoodsTypes = new Set<string>();
    const masterTireBrands = new Set<string>();
    const masterTireSizes = new Set<string>();
    const masterUndersteelParts = new Set<string>();
    const masterPartPositions = new Set<string>();

    let skippedHeader = false;
    let parsedRowsCount = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      if (!skippedHeader) {
        skippedHeader = true;
        continue;
      }

      const cols = parseCSVLine(line);
      if (cols.length < 13) continue;

      const th = cols[2];
      const bln = cols[3];
      const tgl = cols[4];
      const noFactur = cols[5];
      const merkMobil = cols[6];
      const seriesMobil = cols[7];
      const thnMobil = cols[8];
      const konsumen = cols[9];
      const detail = cols[10];
      const itemType = cols[11];
      const kategori = cols[12].trim().toUpperCase();
      const jml = Math.max(1, Number(cols[13]) || 1);
      const bruto = parseIndoNumber(cols[14]);
      const diskon = parseIndoNumber(cols[15]);
      const nett = parseIndoNumber(cols[16]);
      const salesPerson = cols[17] || 'Budi';

      if (!noFactur || noFactur === '-') continue;

      const year = th || '2026';
      const month = String(bln || '04').padStart(2, '0');
      const date = String(tgl || '01').padStart(2, '0');
      const invoiceDate = `${year}-${month}-${date}`;
      const customerName = toTitleCase(konsumen || 'Umum');
      const carBrand = toTitleCase(merkMobil || 'Toyota');
      const carSeries = toTitleCase(seriesMobil || 'Avanza');
      const carYear = Number(thnMobil) || 2018;
      const cleanSales = toTitleCase(salesPerson);

      if (cleanSales) masterSales.add(cleanSales);
      if (carBrand) masterCarBrands.add(carBrand);
      if (carSeries) masterCarSeries.add(carSeries);

      let category: 'Barang' | 'Jasa' | 'Understeel' = 'Jasa';
      if (kategori.includes('BARANG')) {
        category = 'Barang';
      } else if (kategori.includes('UNDERSTEEL')) {
        category = 'Understeel';
      } else {
        category = 'Jasa';
      }

      let goods_type: string | null = null;
      let goods_brand: string | null = null;
      let tire_brand: string | null = null;
      let tire_size: string | null = null;
      let tire_pattern: string | null = null;
      let tire_position: string | null = null;
      let service_type: string | null = null;
      let technician: string | null = null;
      let part_brand: string | null = null;
      let part_position: string | null = null;

      const cleanItemName = toTitleCase(detail);

      if (category === 'Barang') {
        const isBan = itemType.toUpperCase().includes('BAN') || detail.toUpperCase().includes('BAN');
        const isOli = itemType.toUpperCase().includes('OLI') || detail.toUpperCase().includes('OLI');
        const isChemical = itemType.toUpperCase().includes('CHEMICAL') || detail.toUpperCase().includes('CHEMICAL') || detail.toUpperCase().includes('FLUSH');
        
        if (isBan) {
          goods_type = 'Ban';
          tire_brand = parseTireBrand(detail);
          tire_size = parseTireSize(detail);
          goods_brand = tire_brand;
          
          masterGoodsTypes.add('Ban');
          masterTireBrands.add(tire_brand);
          masterTireSizes.add(tire_size);

          if (detail.toUpperCase().includes('DEPAN')) tire_position = 'Depan';
          else if (detail.toUpperCase().includes('BELAKANG')) tire_position = 'Belakang';
          else if (detail.toUpperCase().includes('KIRI')) tire_position = 'Kiri';
          else if (detail.toUpperCase().includes('KANAN')) tire_position = 'Kanan';
          else if (jml >= 4) tire_position = 'Set';
        } else if (isOli) {
          goods_type = 'Oli';
          goods_brand = detail.toUpperCase().includes('MOTUL') ? 'Motul' : detail.toUpperCase().includes('SHELL') ? 'Shell' : 'Lainnya';
          masterGoodsTypes.add('Oli');
        } else if (isChemical) {
          goods_type = 'Chemical';
          goods_brand = 'Lainnya';
          masterGoodsTypes.add('Chemical');
        } else {
          goods_type = 'Lainnya';
          goods_brand = 'Lainnya';
          masterGoodsTypes.add('Lainnya');
        }
      } else if (category === 'Jasa') {
        service_type = toTitleCase(itemType || detail);
        technician = 'Teknisi';
        masterServiceTypes.add(service_type);
      } else if (category === 'Understeel') {
        part_brand = detail.toUpperCase().includes('555') ? '555' : detail.toUpperCase().includes('SGP') ? 'SGP' : 'Lainnya';
        part_position = detail.toUpperCase().includes('DEPAN') ? 'Depan' : detail.toUpperCase().includes('BELAKANG') ? 'Belakang' : 'Depan';
        masterUndersteelParts.add(cleanItemName);
        masterPartPositions.add(part_position);
      }

      const itemRow = {
        category,
        item_name: cleanItemName,
        quantity: jml,
        unit_price: bruto / jml,
        discount: diskon,
        subtotal: bruto, 
        sales_person: cleanSales,
        notes: null,
        goods_type,
        goods_brand,
        tire_brand,
        tire_size,
        tire_pattern,
        tire_position,
        service_type,
        technician,
        part_brand,
        part_position
      };

      if (!invoicesMap.has(noFactur)) {
        invoicesMap.set(noFactur, {
          invoice_date: invoiceDate,
          customer_name: customerName,
          car_brand: carBrand,
          car_series: carSeries,
          car_year: carYear,
          sales_person: cleanSales,
          items: []
        });
      }

      invoicesMap.get(noFactur)!.items.push(itemRow);
      parsedRowsCount++;
    }

    await db.run('BEGIN TRANSACTION');
    try {
      if (mode === 'replace') {
        await db.run('DELETE FROM invoice_items');
        await db.run('DELETE FROM invoices');
        await db.run('DELETE FROM master_data');
      }

      for (const [noFactur, inv] of invoicesMap.entries()) {
        if (mode === 'append') {
          const existing = await db.get('SELECT id FROM invoices WHERE invoice_number = ?', [noFactur]);
          if (existing) {
            await db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [existing.id]);
            await db.run('DELETE FROM invoices WHERE id = ?', [existing.id]);
          }
        }

        const headerRes = await db.run(
          `INSERT INTO invoices (invoice_number, invoice_date, customer_name, car_brand, car_series, car_year, notes, sales_person, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Final')`,
          [noFactur, inv.invoice_date, inv.customer_name, inv.car_brand, inv.car_series, inv.car_year, null, inv.sales_person]
        );
        
        const invoiceId = headerRes.lastID;
        if (!invoiceId) continue;

        for (const item of inv.items) {
          await db.run(
            `INSERT INTO invoice_items (
              invoice_id, category, item_name, quantity, unit_price, discount, subtotal, sales_person, notes,
              goods_type, goods_brand, tire_brand, tire_size, tire_pattern, tire_position,
              service_type, technician, part_brand, part_position
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              invoiceId, item.category, item.item_name, item.quantity, item.unit_price, item.discount, item.subtotal,
              item.sales_person, null, item.goods_type, item.goods_brand, item.tire_brand, item.tire_size,
              item.tire_pattern, item.tire_position, item.service_type, item.technician, item.part_brand, item.part_position
            ]
          );
        }
      }

      const stmt = await db.prepare('INSERT OR IGNORE INTO master_data (category, value) VALUES (?, ?)');
      for (const s of masterSales) await stmt.run('sales', s);
      for (const b of masterCarBrands) await stmt.run('car_brand', b);
      for (const s of masterCarSeries) await stmt.run('car_series', s);
      for (const s of masterServiceTypes) await stmt.run('service_type', s);
      for (const g of masterGoodsTypes) await stmt.run('goods_type', g);
      for (const b of masterTireBrands) await stmt.run('tire_brand', b);
      for (const s of masterTireSizes) await stmt.run('tire_size', s);
      for (const p of masterUndersteelParts) await stmt.run('understeel_part', p);
      for (const p of masterPartPositions) await stmt.run('part_position', p);
      await stmt.finalize();

      await db.run('COMMIT');
      res.json({
        success: true,
        message: `Berhasil mengimpor ${parsedRowsCount} data barang/jasa ke dalam ${invoicesMap.size} invoice unik (${mode === 'replace' ? 'Data lama direset' : 'Data ditambahkan'}).`
      });
    } catch (err: any) {
      await db.run('ROLLBACK');
      res.status(500).json({ success: false, errors: ['Gagal menyimpan data impor: ' + err.message] });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, errors: ['Gagal memproses file CSV: ' + err.message] });
  }
});

export default router;
