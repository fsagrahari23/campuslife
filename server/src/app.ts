import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth.routes';
import gatePassRoutes from './routes/gatePass.routes';
import adminRoutes from './routes/admin.routes';
import syncRoutes from './routes/sync.routes';
import deviceRoutes from './routes/device.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { error: 'Too Many Requests', message: 'Please try again later' },
});
app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60000,
  max: 5,
  message: { error: 'Too Many Requests', message: 'Too many login attempts' },
});
app.use('/api/auth/login', authLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public key endpoint (for mobile apps to fetch the verification key)
app.get('/api/public-key', (_req, res) => {
  res.json({ publicKey: config.ed25519.publicKey });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/gate-passes', gatePassRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/devices', deviceRoutes);

// Error handler
app.use(errorHandler);

export default app;
