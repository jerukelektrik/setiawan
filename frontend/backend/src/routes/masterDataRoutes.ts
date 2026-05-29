import { Router, Request, Response } from 'express';
import { getDb } from '../db/db.js';

const router = Router();

// GET all master data autocomplete entries grouped by category
router.get('/', async (req: Request, res: Response) => {
  const db = await getDb();

  try {
    const rawData = await db.all('SELECT category, value FROM master_data ORDER BY value ASC');
    
    // Group by category
    const grouped: { [key: string]: string[] } = {
      sales: [],
      car_brand: [],
      car_series: [],
      service_type: [],
      goods_type: [],
      tire_brand: [],
      tire_size: [],
      understeel_part: [],
      part_position: []
    };

    rawData.forEach(item => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item.value);
    });

    res.json({
      success: true,
      data: grouped
    });
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

// POST a new autocomplete value for a specific category
router.post('/:category', async (req: Request, res: Response) => {
  const db = await getDb();
  const category = req.params.category;
  const { value } = req.body;

  if (!value || typeof value !== 'string' || value.trim() === '') {
    return res.status(400).json({ success: false, errors: ['Value is required'] });
  }

  const cleanVal = value.trim();

  try {
    await db.run(
      'INSERT OR IGNORE INTO master_data (category, value) VALUES (?, ?)',
      [category, cleanVal]
    );

    res.json({ success: true, message: 'Master data registered successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [err.message] });
  }
});

export default router;
