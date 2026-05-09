const express = require('express');
const supabase = require('../supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ── List all open jobs (carriers see this) ──
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { vehicle_type, city } = req.query;

    let query = supabase
      .from('jobs')
      .select(`
        *,
        shipper:users!jobs_shipper_id_fkey(id, name, company_name, rating, review_count)
      `)
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (vehicle_type) query = query.eq('vehicle_type', vehicle_type);
    if (city) query = query.or(`pickup_city.ilike.%${city}%,dropoff_city.ilike.%${city}%`);

    const { data: jobs, error } = await query;
    if (error) throw error;

    res.json({ jobs: jobs || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get my jobs (shippers see their own jobs) ──
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('shipper_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ jobs: jobs || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get a single job ──
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        *,
        shipper:users!jobs_shipper_id_fkey(id, name, company_name, phone, rating)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create a job (shippers only) ──
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'shipper') {
      return res.status(403).json({ error: 'Only shippers can post jobs' });
    }

    const {
      pickup_city, pickup_address, dropoff_city, dropoff_address,
      goods_type, weight_kg, description, vehicle_type,
      required_date, addons, budget_min, budget_max, budget_preset
    } = req.body;

    if (!pickup_city || !dropoff_city || !goods_type || !weight_kg || !description || !vehicle_type || !required_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        shipper_id: req.user.id,
        pickup_city, pickup_address,
        dropoff_city, dropoff_address,
        goods_type, weight_kg: Number(weight_kg),
        description, vehicle_type,
        required_date,
        addons: addons || [],
        budget_min: budget_min ? Number(budget_min) : null,
        budget_max: budget_max ? Number(budget_max) : null,
        budget_preset: budget_preset || null,
        status: 'open',
        quote_count: 0,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ job });
  } catch (err) {
    console.error('Create job error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Update job status ──
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['open', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Verify ownership
    const { data: job } = await supabase.from('jobs').select('shipper_id').eq('id', req.params.id).single();
    if (!job || job.shipper_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: updated, error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ job: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Shipper stats ──
router.get('/stats/shipper', authMiddleware, async (req, res) => {
  try {
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, status')
      .eq('shipper_id', req.user.id);

    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, status, amount, job:jobs!quotes_job_id_fkey(shipper_id)')
      .eq('status', 'accepted');

    const myJobs = jobs || [];
    const acceptedQuotes = (quotes || []).filter(q => q.job?.shipper_id === req.user.id);
    const totalSpent = acceptedQuotes.reduce((sum, q) => sum + (q.amount || 0), 0);

    res.json({
      total_jobs: myJobs.length,
      active_jobs: myJobs.filter(j => j.status === 'open').length,
      pending_quotes: myJobs.filter(j => j.status === 'open').length,
      completed_jobs: myJobs.filter(j => j.status === 'completed').length,
      total_spent: totalSpent,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Carrier stats ──
router.get('/stats/carrier', authMiddleware, async (req, res) => {
  try {
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, status, amount')
      .eq('carrier_id', req.user.id);

    const myQuotes = quotes || [];
    const accepted = myQuotes.filter(q => q.status === 'accepted');
    const totalRevenue = accepted.reduce((sum, q) => sum + (q.amount || 0), 0);
    const acceptanceRate = myQuotes.length > 0
      ? Math.round((accepted.length / myQuotes.length) * 100)
      : 0;

    const { data: userInfo } = await supabase
      .from('users')
      .select('rating, review_count')
      .eq('id', req.user.id)
      .single();

    res.json({
      total_revenue: totalRevenue,
      completed_jobs: accepted.length,
      acceptance_rate: acceptanceRate,
      rating: userInfo?.rating || 0,
      review_count: userInfo?.review_count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
