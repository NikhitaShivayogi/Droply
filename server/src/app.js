import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import api from './routes/api.js';
import { errorHandler, notFound } from './middleware/errors.js';
import Drop from './models/Drop.js';
import { hashCode, managementSecretMatches } from './utils/secrets.js';

export function createApp() {
  const app = express();
  const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((item) => item.trim());
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
  });

  app.set('io', io);
  if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'blob:'],
        'media-src': ["'self'", 'blob:']
      }
    }
  }));
  app.use(cors({ origin: allowedOrigins, methods: ['GET', 'POST', 'DELETE'], allowedHeaders: ['Content-Type', 'X-Management-Secret', 'X-Drop-Code'] }));
  app.use(compression());
  app.use(express.json({ limit: '450kb' }));
  app.use('/api/v1', rateLimit({
    windowMs: 60_000,
    limit: 90,
    standardHeaders: 'draft-7',
    legacyHeaders: false
  }));
  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  app.use('/api/v1', api);
  app.use(notFound);
  app.use(errorHandler);

  io.on('connection', (socket) => {
    socket.on('drop:subscribe', async ({ dropId, code, managementSecret } = {}, acknowledge = () => {}) => {
      try {
        if (socket.data.lastDropAuth && Date.now() - socket.data.lastDropAuth < 1000) {
          return acknowledge({ error: 'Please wait before retrying.' });
        }
        socket.data.lastDropAuth = Date.now();
        if (typeof dropId !== 'string' || !/^[a-f\d]{24}$/i.test(dropId)) {
          return acknowledge({ error: 'Drop unavailable.' });
        }
        const drop = await Drop.findById(dropId).select('status expiresAt codeHash managementHash').lean();
        if (!drop || drop.expiresAt <= new Date()) return acknowledge({ error: 'Drop unavailable.' });
        const creatorAccess = drop.status === 'uploading' && managementSecretMatches(managementSecret, drop.managementHash);
        const recipientAccess = drop.status === 'ready' && typeof code === 'string' && code.length <= 24 &&
          drop.codeHash === hashCode(code.replace(/[\s-]/g, '').toUpperCase());
        if (!creatorAccess && !recipientAccess) return acknowledge({ error: 'Drop unavailable.' });
        socket.join(`drop:${dropId}`);
        acknowledge({ status: 'subscribed' });
      } catch (error) {
        console.error('Socket authorization failed:', error);
        acknowledge({ error: 'Unable to verify this Drop right now.' });
      }
    });
  });

  return { app, httpServer, io };
}
