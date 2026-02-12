import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './src/config/db.js';
import express from 'express';
import cors from 'cors';
dotenv.config();

const PORT = process.env.PORT || 5000;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

connectDB();

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});