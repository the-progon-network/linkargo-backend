const express = require('express');
const supabase = require('../supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ── Get quotes for a job (shipper sees all quotes on their job) ──
router.get('/job/:jobId', authMiddleware, async (req, res) => {
  try {
    const { data: quotes, error } = await supabase
      .from('quotes')
      .select(`
        *,
        carrier:users!quotes_carrier_id_fkey(id, name, phone, vehicle_type, license_plate, rating, review_count, is_verified)
      `)
      .eq('job_id', req.params.jobId)
      .order('amount', { ascending: true });

    if (error) throw error;
    res.json({ quotes: quotes || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get my quotes (carrier sees their own quotes) ──
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const { data: quotes, error } = await supabase
      .from('quotes')
      .select(`
        *,
        job:jobs!quotes_job_id_fkey(
          id, pickup_city, dropoff_city, goods_type, weight_kg,
          vehicle_type, required_date, status,
          shipper:users!jobs_shipper_id_fkey(id, name, company_name)
        )
      `)
      .eq('carrier_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ quotes: quotes || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Submit a quote (carriers only) ──
router.post('/:jobId', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'carrier') {
      return res.status(403).json({ error: 'Only carriers can submit quotes' });
    }

    const { amount, eta_hours, note } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount is required' });

    // Check job exists and is open
    const { data: job } = await supabase
      .from('jobs')
      .select('id, status, shipper_id')
      .eq('id', req.params.jobId)
      .single();

    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'open') return res.status(400).json({ error: 'Job is no longer accepting quotes' });
    if (job.shipper_id === req.user.id) return res.status(400).json({ error: 'Cannot quote your own job' });

    const { data: quote, error } = await supabase
      .from('quotes')
      .insert({
        job_id: req.params.jobId,
        carrier_id: req.user.id,
        amount: Number(amount),
        eta_hours: eta_hours ? Number(eta_hours) : null,
        note: note || null,
        status: 'pending',
      })
      .select(`
        *,
        carrier:users!quotes_carrier_id_fkey(id, name, phone, vehicle_type, rating, review_count, is_verified)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'You have already submitted a quote for this job' });
      }
      throw error;
    }

    // Increment quote_count on job
    try {
      const { data: jobData } = await supabase.from('jobs').select('quote_count').eq('id', req.params.jobId).single();
      await supabase.from('jobs').update({ quote_count: (jobData?.quote_count || 0) + 1 }).eq('id', req.params.jobId);
    } catch (e) {
      console.error('quote_count update failed:', e);
    }

    res.status(201).json({ quote });
  } catch (err) {
    console.error('Submit quote error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Accept a quote (shippers only) ──
router.patch('/:quoteId/accept', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'shipper') {
      return res.status(403).json({ error: 'Only shippers can accept quotes' });
    }

    // Get quote and verify job ownership
    const { data: quote } = await supabase
      .from('quotes')
      .select('*, job:jobs!quotes_job_id_fkey(id, shipper_id)')
      .eq('id', req.params.quoteId)
      .single();

    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    if (quote.job?.shipper_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Accept this quote
    await supabase.from('quotes').update({ status: 'accepted' }).eq('id', req.params.quoteId);

    // Reject all other quotes for this job
    await supabase
      .from('quotes')
      .update({ status: 'rejected' })
      .eq('job_id', quote.job_id)
      .neq('id', req.params.quoteId);

    // Update job status to in_progress and store accepted_quote_id
    await supabase
      .from('jobs')
      .update({ status: 'in_progress', accepted_quote_id: req.params.quoteId })
      .eq('id', quote.job_id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Reject a quote (shippers only) ──
router.patch('/:quoteId/reject', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'shipper') {
      return res.status(403).json({ error: 'Only shippers can reject quotes' });
    }

    const { data: quote } = await supabase
      .from('quotes')
      .select('*, job:jobs!quotes_job_id_fkey(shipper_id)')
      .eq('id', req.params.quoteId)
      .single();

    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    if (quote.job?.shipper_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await supabase.from('quotes').update({ status: 'rejected' }).eq('id', req.params.quoteId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;