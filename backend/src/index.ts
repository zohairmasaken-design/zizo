import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { supabase } from './config/supabase';

// Load env vars
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Masaken Fandkanood Backend (Orchestration Layer)',
    status: 'active',
    role: 'Orchestrator - No Financial Logic Here'
  });
});

// Example: Availability Check (Allowed in Node)
app.get('/api/check-availability', async (req, res) => {
    // Logic to call Supabase RPC or Select
    // Just a placeholder
    res.json({ available: true, message: "Checked against DB" });
});

// Example: Create Booking (Orchestration Only)
// Receives request -> Validate -> Calls Supabase 'create_booking' RPC
app.post('/api/bookings', async (req, res) => {
    try {
        const { customerId, roomId, dates } = req.body;
        
        // 1. Validation (Basic)
        if (!customerId || !roomId) {
             res.status(400).json({ error: 'Missing fields' });
             return;
        }

        // 2. Call Database RPC (The Brain)
        // const { data, error } = await supabase.rpc('create_booking_v3', { ... });
        
        // Mock response for now
        res.json({ 
            success: true, 
            message: "Booking request sent to DB Engine",
            note: "Financials handled by DB Triggers" 
        });

    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
