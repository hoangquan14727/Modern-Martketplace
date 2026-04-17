const { pool } = require('../config/database');
const { paginate, paginateResponse } = require('../utils/helpers');
const getNotifications = async (req, res) => {
  try {
    const { page, limit, type, is_read } = req.query;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = 'WHERE user_id = ?';
    const params = [req.user.id];
    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }
    if (is_read !== undefined) {
      whereClause += ' AND is_read = ?';
      params.push(is_read === 'true' ? 1 : 0);
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM notifications ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [notifications] = await pool.query(
      `SELECT * FROM notifications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    const [unreadResult] = await pool.query(
      'SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({
      success: true,
      ...paginateResponse(notifications, total, pageNum, limitNum),
      unread_count: unreadResult[0].unread
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications.'
    });
  }
};
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.'
      });
    }
    res.json({
      success: true,
      message: 'Notification marked as read.'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification.'
    });
  }
};
const markAllAsRead = async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({
      success: true,
      message: 'All notifications marked as read.'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notifications.'
    });
  }
};
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.'
      });
    }
    res.json({
      success: true,
      message: 'Notification deleted.'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification.'
    });
  }
};
const sendNotification = async (req, res) => {
  try {
    const { userId, title, message, type, data } = req.body;
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, data)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title, message, type || 'system', data ? JSON.stringify(data) : null]
    );
    res.status(201).json({
      success: true,
      message: 'Notification sent.'
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification.'
    });
  }
};
const sendBulkNotification = async (req, res) => {
  try {
    const { userIds, role, title, message, type, data } = req.body;
    let targetUsers = [];
    if (userIds && userIds.length > 0) {
      targetUsers = userIds;
    } else if (role) {
      const [users] = await pool.query(
        "SELECT id FROM users WHERE role = ? AND status = 'active'",
        [role]
      );
      targetUsers = users.map(u => u.id);
    }
    if (targetUsers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No target users found.'
      });
    }
    const values = targetUsers.map(userId => [
      userId,
      title,
      message,
      type || 'system',
      data ? JSON.stringify(data) : null
    ]);
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, data)
       VALUES ?`,
      [values]
    );
    res.status(201).json({
      success: true,
      message: `Notification sent to ${targetUsers.length} users.`
    });
  } catch (error) {
    console.error('Send bulk notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notifications.'
    });
  }
};
const createNotification = (userId, title, message, type = 'system', data = null) => {
  try {
    pool.query(
      `INSERT INTO notifications (user_id, title, message, type, data)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title, message, type, data ? JSON.stringify(data) : null]
    );
    return true;
  } catch (error) {
    console.error('Create notification error:', error);
    return false;
  }
};
module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendNotification,
  sendBulkNotification,
  createNotification
};
