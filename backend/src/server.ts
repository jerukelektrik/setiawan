import express from 'express';
import cors from 'cors';
import { getDb } from './db/db.js';
import invoiceRouter from './routes/invoiceRoutes.js';
import analyticsRouter from './routes/analyticsRoutes.js';
import exportRouter from './routes/exportRoutes.js';
import masterDataRouter from './routes/masterDataRoutes.js';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/invoices', invoiceRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/export', exportRouter);
app.use('/api/master-data', masterDataRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, errors: ['Internal Server Error: ' + err.message] });
});

// Initialize database & start server
async function startServer() {
  try {
    console.log('Initializing SQLite Database...');
    await getDb();
    
    app.listen(PORT, () => {
      console.log(`Backend Express server listening at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize database or start server:', err);
    process.exit(1);
  }
}

startServer();
