import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import aiRoutes from './routes/aiRoutes';
import projectRoutes from './routes/projectRoutes';
import sequelize from './config/database';
import { registerDiscoveryChatSocketService } from './services/discoveryChatSocketService';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/ai', aiRoutes);
app.use('/projects', projectRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

registerDiscoveryChatSocketService(server);

// Sync database and start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Sync models (create tables if they don't exist)
    // In production, use migrations instead of sync({ alter: true })
    await sequelize.sync({ alter: true });
    console.log('Database synced.');

    server.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

startServer();
