const express = require('express');
const supabase = require('../supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ── Update profile ──
router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const { name, phone, company_name, vehicle_type, license_plate } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (company_name !== undefined) updates.company_name = company_name;
    if (vehicle_type !== undefined) updates.vehicle_type = vehicle_type;
    if (license_plate !== undefined) updates.license_plate = license_plate;

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, name, email, phone, role, company_name, vehicle_type, license_plate, is_verified, rating, review_count')
      .single();

    if (error) throw error;
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
