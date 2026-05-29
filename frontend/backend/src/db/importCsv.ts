import fs from 'fs';
import path from 'path';
import { getDb } from './db.js';

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

// Clean number strings from Indonesian dots thousands separator
function parseIndoNumber(str: string): number {
  if (!str || str.trim() === '0' || str.trim() === '') return 0;
  // Remove dots used as thousands separator
  const clean = str.replace(/\./g, '');
  const num = Number(clean);
  return isNaN(num) ? 0 : num;
}

// Helper to extract tire size from item detail string
function parseTireSize(detail: string): string {
  // Try pattern like '175 65 14' or '185 70 14'
  const sizePattern3 = /(\d{3})\s+(\d{2})\s+(\d{2})/;
  const match3 = detail.match(sizePattern3);
  if (match3) {
    return `${match3[1]}/${match3[2]} R${match3[3]}`;
  }

  // Try pattern like '185 14' or '195 15'
  const sizePattern2 = /(\d{3})\s+(\d{2})/;
  const match2 = detail.match(sizePattern2);
  if (match2) {
    return `${match2[1]} R${match2[2]}`;
  }

  // Try standard R size like 'R14' or 'R15'
  const rPattern = /R\s*(\d{2})/i;
  const rMatch = detail.match(rPattern);
  if (rMatch) {
    return `R${rMatch[1]}`;
  }

  return '185/70 R14'; // reasonable fallback
}

// Helper to extract tire brand from item detail string
function parseTireBrand(detail: string): string {
  const upper = detail.toUpperCase();
  if (upper.includes('GT') || upper.includes('CHAMPIRO') || upper.includes('GAJAH TUNGGAL')) return 'Gajah Tunggal';
  if (upper.includes('BRIDGESTONE') || upper.includes('BS') || upper.includes('ECOPIA') || upper.includes('TURANZA')) return 'Bridgestone';
  if (upper.includes('DUNLOP') || upper.includes('ENASAVE')) return 'Dunlop';
  if (upper.includes('MICHELIN') || upper.includes('XM2')) return 'Michelin';
  if (upper.includes('ACHILLES')) return 'Achilles';
  if (upper.includes('LAUFENN')) return 'Laufenn';
  if (upper.includes('FALKEN')) return 'Falken';
  
  // Extract first word
  const firstWord = detail.split(' ')[0];
  if (firstWord && firstWord.length > 2) return toTitleCase(firstWord);
  return 'Lainnya';
}

async function runImport() {
  const csvPath = '/Users/armadanurliansyah/Downloads/Report - DATA APRIL.csv';
  console.log(`Starting CSV import from: ${csvPath}`);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`Error: CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  const db = await getDb();
  console.log('Clearing old sample database records...');
  await db.run('BEGIN TRANSACTION');
  try {
    await db.run('DELETE FROM invoice_items');
    await db.run('DELETE FROM invoices');
    await db.run('DELETE FROM master_data');
    await db.run('COMMIT');
    console.log('Database cleared.');
  } catch (err) {
    await db.run('ROLLBACK');
    console.error('Failed to clear database:', err);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/);
  console.log(`Total CSV lines to process: ${lines.length}`);

  // Group items by NO FACTUR
  // Key: invoice_number
  const invoicesMap = new Map<string, {
    invoice_date: string;
    customer_name: string;
    car_brand: string;
    car_series: string;
    car_year: number;
    sales_person: string;
    items: any[];
  }>();

  // Master Data Suggestions Collectors
  const masterSales = new Set<string>();
  const masterCarBrands = new Set<string>();
  const masterCarSeries = new Set<string>();
  const masterServiceTypes = new Set<string>();
  const masterGoodsTypes = new Set<string>();
  const masterTireBrands = new Set<string>();
  const masterTireSizes = new Set<string>();
  const masterUndersteelParts = new Set<string>();
  const masterPartPositions = new Set<string>();

  // Skip header line 0
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

    // NO,NAMA OUTLET,TH,BLN,TGL,NO FACTUR,MERK MOBIL,SERIES MOBIL,THN MOBIL,KONSUMEN,DETAIL,ITEM,KATEGORI,JML,OMZET BRUTO,DISKON,OMZET NETT,SALES
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

    const invoiceDate = `${th}-${String(bln).padStart(2, '0')}-${String(tgl).padStart(2, '0')}`;
    const customerName = toTitleCase(konsumen || 'Umum');
    const carBrand = toTitleCase(merkMobil || 'Toyota');
    const carSeries = toTitleCase(seriesMobil || 'Avanza');
    const carYear = Number(thnMobil) || 2018;
    const cleanSales = toTitleCase(salesPerson);

    // Save to master data suggestion sets
    if (cleanSales) masterSales.add(cleanSales);
    if (carBrand) masterCarBrands.add(carBrand);
    if (carSeries) masterCarSeries.add(carSeries);

    // Category mapping
    let category: 'Barang' | 'Jasa' | 'Understeel' = 'Jasa';
    if (kategori.includes('BARANG')) {
      category = 'Barang';
    } else if (kategori.includes('UNDERSTEEL')) {
      category = 'Understeel';
    } else {
      category = 'Jasa';
    }

    // Category-specific details
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

        // Detect tire position from name
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
      subtotal: bruto, // Set subtotal to bruto (OMZET BRUTO) as requested
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

  console.log(`Parsed ${parsedRowsCount} items into ${invoicesMap.size} unique Invoices.`);
  console.log('Inserting records into SQLite database inside a single transaction...');

  await db.run('BEGIN TRANSACTION');
  try {
    // 1. Insert Invoices & Invoice Items
    for (const [noFactur, inv] of invoicesMap.entries()) {
      const headerRes = await db.run(
        `INSERT INTO invoices (invoice_number, invoice_date, customer_name, car_brand, car_series, car_year, notes, sales_person, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Final')`,
        [
          noFactur,
          inv.invoice_date,
          inv.customer_name,
          inv.car_brand,
          inv.car_series,
          inv.car_year,
          null,
          inv.sales_person,
        ]
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
            invoiceId,
            item.category,
            item.item_name,
            item.quantity,
            item.unit_price,
            item.discount,
            item.subtotal,
            item.sales_person,
            null,
            item.goods_type,
            item.goods_brand,
            item.tire_brand,
            item.tire_size,
            item.tire_pattern,
            item.tire_position,
            item.service_type,
            item.technician,
            item.part_brand,
            item.part_position
          ]
        );
      }
    }

    // 2. Insert populated Autocomplete Suggestions
    console.log('Inserting master data suggestions...');
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
    console.log('Import completed successfully!');
  } catch (err: any) {
    await db.run('ROLLBACK');
    console.error('Import transaction failed, rolling back:', err);
    process.exit(1);
  }
}

runImport();
