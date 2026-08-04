import Settings from '../models/Settings.js';
import jwt from 'jsonwebtoken';

export async function checkMaintenance(req, res, next) {
  // Allow all requests to admin endpoints directly
  if (req.path.startsWith('/api/admin')) {
    return next();
  }

  try {
    const maintenanceSetting = await Settings.findOne({ key: 'maintenance_mode' });
    const isMaintenance = maintenanceSetting ? maintenanceSetting.value : false;

    if (isMaintenance) {
      // Allow logged-in admin to bypass
      const token = req.cookies?.dseu_unfiltered_admin;
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
          if (decoded.username === (process.env.ADMIN_USERNAME || 'administrator')) {
            return next();
          }
        } catch (err) {
          // Token expired or invalid, block request
        }
      }

      const msgSetting = await Settings.findOne({ key: 'maintenance_message' });
      const message = msgSetting ? msgSetting.value : 'DSEU Unfiltered is currently undergoing scheduled maintenance. We will be back online shortly!';

      return res.status(503).json({
        error: 'MAINTENANCE_MODE',
        message: message
      });
    }
  } catch (err) {
    console.error('Error in maintenance middleware:', err);
  }

  next();
}
