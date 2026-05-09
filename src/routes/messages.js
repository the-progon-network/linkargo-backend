const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Auth middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/messages/conversations
// Returns all conversations for the logged-in user
// (one conversation per job where they sent or received a message)
router.get('/conversations', auth, async (req, res) => {
  const userId = req.user.id;

  // Get all messages where user is sender or receiver, get latest per job
  const { data, error } = await supabase
    .from('messages')
    .select(`
      id,
      job_id,
      text,
      is_read,
      created_at,
      sender:sender_id (id, name, role),
      receiver:receiver_id (id, name, role),
      job:job_id (id, goods_type, pickup_city, dropoff_city, status)
    `)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Deduplicate: one entry per job_id (latest message)
  const seen = new Set();
  const conversations = [];
  for (const msg of data) {
    if (!seen.has(msg.job_id)) {
      seen.add(msg.job_id);
      // The "other" person in the conversation
      const other = msg.sender.id === userId ? msg.receiver : msg.sender;
      // Unread count for this job
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', msg.job_id)
        .eq('receiver_id', userId)
        .eq('is_read', false);
      conversations.push({
        job_id: msg.job_id,
        job: msg.job,
        other_user: other,
        last_message: msg.text,
        last_message_at: msg.created_at,
        unread_count: count || 0,
      });
    }
  }

  res.json(conversations);
});

// GET /api/messages/:jobId
// Returns all messages for a specific job conversation
router.get('/:jobId', auth, async (req, res) => {
  const { jobId } = req.params;
  const userId = req.user.id;

  const { data, error } = await supabase
    .from('messages')
    .select(`
      id,
      text,
      is_read,
      created_at,
      sender:sender_id (id, name, role),
      receiver:receiver_id (id, name, role)
    `)
    .eq('job_id', jobId)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Mark messages sent TO this user as read
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('job_id', jobId)
    .eq('receiver_id', userId)
    .eq('is_read', false);

  res.json(data);
});

// POST /api/messages/:jobId
// Send a message in a job conversation
router.post('/:jobId', auth, async (req, res) => {
  const { jobId } = req.params;
  const { text, receiver_id } = req.body;
  const senderId = req.user.id;

  if (!text?.trim()) return res.status(400).json({ error: 'Message cannot be empty' });
  if (!receiver_id) return res.status(400).json({ error: 'receiver_id is required' });

  // Verify the job exists and both users are part of it
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, shipper_id, accepted_quote_id')
    .eq('id', jobId)
    .single();

  if (jobError || !job) return res.status(404).json({ error: 'Job not found' });

  // Insert the message
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      job_id: jobId,
      sender_id: senderId,
      receiver_id,
      text: text.trim(),
    })
    .select(`
      id,
      text,
      is_read,
      created_at,
      sender:sender_id (id, name, role),
      receiver:receiver_id (id, name, role)
    `)
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json(message);
});

// PATCH /api/messages/:jobId/read
// Mark all messages in a job as read for the current user
router.patch('/:jobId/read', auth, async (req, res) => {
  const { jobId } = req.params;
  const userId = req.user.id;

  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('job_id', jobId)
    .eq('receiver_id', userId);

  res.json({ ok: true });
});

module.exports = router;