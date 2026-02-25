import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import express from 'express';
import cors from 'cors';

import authRoutes from './src/routes/authRoutes.js';
import chatRoutes from './src/routes/chatRoutes.js';
import conversationRoutes from './src/routes/conversationRoutes.js'
import transactionRoutes from './src/routes/transactionRoutes.js';
import { setupQdrant } from './src/config/qdrant.js';

dotenv.config();
connectDB();
setupQdrant();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/transactions', transactionRoutes);

app.listen(process.env.PORT, () => {
  console.log("Server running");
});