const { pool } = require('../config/database');
const { paginate, paginateResponse } = require('../utils/helpers');
const getActivePromotions = async (req, res) => {
  try {
    const { shop_id, page, limit } = req.query;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = "WHERE p.is_active = 1 AND p.start_date <= datetime('now') AND p.end_date >= datetime('now')";
    const params = [];
    if (shop_id) {
      whereClause += ' AND (p.shop_id = ? OR p.shop_id IS NULL)';
      params.push(shop_id);
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM promotions p ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [promotions] = await pool.query(
      `SELECT
        p.*,
        s.shop_name,
        (SELECT code FROM coupons WHERE promotion_id = p.id AND is_active = 1 LIMIT 1) as coupon_code
      FROM promotions p
      LEFT JOIN shops s ON p.shop_id = s.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(promotions, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get active promotions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get promotions.'
    });
  }
};
const validateCoupon = async (req, res) => {
  try {
    const { code, shopId, orderAmount } = req.body;
    const [customers] = await pool.query(
      'SELECT id FROM customers WHERE user_id = ?',
      [req.user.id]
    );
    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.'
      });
    }
    const customerId = customers[0].id;
    const [coupons] = await pool.query(
      `SELECT c.*, p.type, p.value, p.min_order_amount, p.max_discount_amount,
              p.usage_limit, p.used_count, p.start_date, p.end_date, p.shop_id, p.name as promotion_name
       FROM coupons c
       JOIN promotions p ON c.promotion_id = p.id
       WHERE UPPER(c.code) = UPPER(?) AND c.is_active = 1
       AND p.is_active = 1
       AND p.start_date <= datetime('now')
       AND p.end_date >= datetime('now')`,
      [code]
    );
    if (coupons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired coupon.'
      });
    }
    const coupon = coupons[0];
    if (coupon.shop_id && coupon.shop_id !== parseInt(shopId)) {
      return res.status(400).json({
        success: false,
        message: 'This coupon is not valid for this shop.'
      });
    }
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return res.status(400).json({
        success: false,
        message: 'Coupon has reached usage limit.'
      });
    }
    const [usage] = await pool.query(
      'SELECT id FROM coupon_usage WHERE coupon_id = ? AND customer_id = ?',
      [coupon.id, customerId]
    );
    if (usage.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this coupon.'
      });
    }
    if (coupon.min_order_amount && orderAmount < coupon.min_order_amount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount is ${coupon.min_order_amount}.`
      });
    }
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = (orderAmount * coupon.value) / 100;
    } else if (coupon.type === 'fixed_amount') {
      discount = coupon.value;
    } else if (coupon.type === 'free_shipping') {
      discount = 30000; 
    }
    if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
      discount = coupon.max_discount_amount;
    }
    res.json({
      success: true,
      data: {
        coupon_id: coupon.id,
        code: coupon.code,
        promotion_name: coupon.promotion_name,
        type: coupon.type,
        discount_amount: discount,
        final_amount: orderAmount - discount
      }
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate coupon.'
    });
  }
};
const getShopPromotions = async (req, res) => {
  try {
    const { page, limit, status } = req.query;
    const [shops] = await pool.query(
      'SELECT id FROM shops WHERE user_id = ?',
      [req.user.id]
    );
    if (shops.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found.'
      });
    }
    const shopId = shops[0].id;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = 'WHERE shop_id = ?';
    const params = [shopId];
    if (status === 'active') {
      whereClause += " AND is_active = 1 AND start_date <= datetime('now') AND end_date >= datetime('now')";
    } else if (status === 'upcoming') {
      whereClause += " AND is_active = 1 AND start_date > datetime('now')";
    } else if (status === 'expired') {
      whereClause += " AND end_date < datetime('now')";
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM promotions ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [promotions] = await pool.query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM coupons WHERE promotion_id = p.id) as coupon_count
       FROM promotions p
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(promotions, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get shop promotions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get promotions.'
    });
  }
};
const createPromotion = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      name,
      description,
      type,
      value,
      minOrderAmount,
      maxDiscountAmount,
      usageLimit,
      startDate,
      endDate,
      couponCode
    } = req.body;
    const [shops] = await connection.query(
      'SELECT id FROM shops WHERE user_id = ?',
      [req.user.id]
    );
    if (shops.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found.'
      });
    }
    const shopId = shops[0].id;
    if (couponCode) {
      const [existing] = await connection.query(
        'SELECT id FROM coupons WHERE code = ?',
        [couponCode]
      );
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Coupon code already exists.'
        });
      }
    }
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO promotions
       (shop_id, name, description, type, value, min_order_amount, max_discount_amount, usage_limit, start_date, end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'shop')`,
      [shopId, name, description || null, type, value, minOrderAmount || null, maxDiscountAmount || null, usageLimit || null, startDate, endDate]
    );
    const promotionId = result.insertId;
    if (couponCode) {
      await connection.query(
        'INSERT INTO coupons (promotion_id, code) VALUES (?, ?)',
        [promotionId, couponCode.toUpperCase()]
      );
    }
    await connection.commit();
    res.status(201).json({
      success: true,
      message: 'Promotion created successfully.',
      data: { id: promotionId }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create promotion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create promotion.'
    });
  } finally {
    connection.release();
  }
};
const updatePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      type,
      value,
      minOrderAmount,
      maxDiscountAmount,
      usageLimit,
      startDate,
      endDate,
      isActive
    } = req.body;
    const [shops] = await pool.query(
      'SELECT id FROM shops WHERE user_id = ?',
      [req.user.id]
    );
    if (shops.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found.'
      });
    }
    const [promotions] = await pool.query(
      'SELECT id FROM promotions WHERE id = ? AND shop_id = ?',
      [id, shops[0].id]
    );
    if (promotions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found.'
      });
    }
    const updates = [];
    const params = [];
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (type !== undefined) {
      updates.push('type = ?');
      params.push(type);
    }
    if (value !== undefined) {
      updates.push('value = ?');
      params.push(value);
    }
    if (minOrderAmount !== undefined) {
      updates.push('min_order_amount = ?');
      params.push(minOrderAmount);
    }
    if (maxDiscountAmount !== undefined) {
      updates.push('max_discount_amount = ?');
      params.push(maxDiscountAmount);
    }
    if (usageLimit !== undefined) {
      updates.push('usage_limit = ?');
      params.push(usageLimit);
    }
    if (startDate !== undefined) {
      updates.push('start_date = ?');
      params.push(startDate);
    }
    if (endDate !== undefined) {
      updates.push('end_date = ?');
      params.push(endDate);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    if (updates.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE promotions SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }
    res.json({
      success: true,
      message: 'Promotion updated successfully.'
    });
  } catch (error) {
    console.error('Update promotion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update promotion.'
    });
  }
};
const deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const [shops] = await pool.query(
      'SELECT id FROM shops WHERE user_id = ?',
      [req.user.id]
    );
    if (shops.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found.'
      });
    }
    const [result] = await pool.query(
      'DELETE FROM promotions WHERE id = ? AND shop_id = ?',
      [id, shops[0].id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found.'
      });
    }
    res.json({
      success: true,
      message: 'Promotion deleted successfully.'
    });
  } catch (error) {
    console.error('Delete promotion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete promotion.'
    });
  }
};
const getAllPromotions = async (req, res) => {
  try {
    const { page, limit, shop_id, status } = req.query;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (shop_id) {
      whereClause += ' AND p.shop_id = ?';
      params.push(shop_id);
    }
    if (status === 'active') {
      whereClause += " AND p.is_active = 1 AND p.start_date <= datetime('now') AND p.end_date >= datetime('now')";
    } else if (status === 'inactive') {
      whereClause += ' AND p.is_active = 0';
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM promotions p ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [promotions] = await pool.query(
      `SELECT p.*, s.shop_name,
        (SELECT code FROM coupons WHERE promotion_id = p.id AND is_active = 1 LIMIT 1) as coupon_code,
        (SELECT COUNT(*) FROM coupon_usage WHERE coupon_id IN (SELECT id FROM coupons WHERE promotion_id = p.id)) as total_usage
       FROM promotions p
       LEFT JOIN shops s ON p.shop_id = s.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(promotions, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get all promotions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get promotions.'
    });
  }
};
const createSystemPromotion = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      name,
      description,
      type,
      value,
      minOrderAmount,
      maxDiscountAmount,
      usageLimit,
      startDate,
      endDate,
      couponCode
    } = req.body;
    if (couponCode) {
      const [existing] = await connection.query(
        'SELECT id FROM coupons WHERE code = ?',
        [couponCode]
      );
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Coupon code already exists.'
        });
      }
    }
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO promotions
       (shop_id, name, description, type, value, min_order_amount, max_discount_amount, usage_limit, start_date, end_date, created_by)
       VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin')`,
      [name, description || null, type, value, minOrderAmount || null, maxDiscountAmount || null, usageLimit || null, startDate, endDate]
    );
    const promotionId = result.insertId;
    if (couponCode) {
      await connection.query(
        'INSERT INTO coupons (promotion_id, code) VALUES (?, ?)',
        [promotionId, couponCode.toUpperCase()]
      );
    }
    await connection.commit();
    res.status(201).json({
      success: true,
      message: 'System promotion created successfully.',
      data: { id: promotionId }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create system promotion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create promotion.'
    });
  } finally {
    connection.release();
  }
};
const updateSystemPromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      type,
      value,
      minOrderAmount,
      maxDiscountAmount,
      usageLimit,
      startDate,
      endDate,
      isActive
    } = req.body;
    const [promotions] = await pool.query(
      'SELECT id FROM promotions WHERE id = ? AND shop_id IS NULL',
      [id]
    );
    if (promotions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'System promotion not found.'
      });
    }
    const updates = [];
    const params = [];
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (type !== undefined) {
      updates.push('type = ?');
      params.push(type);
    }
    if (value !== undefined) {
      updates.push('value = ?');
      params.push(value);
    }
    if (minOrderAmount !== undefined) {
      updates.push('min_order_amount = ?');
      params.push(minOrderAmount);
    }
    if (maxDiscountAmount !== undefined) {
      updates.push('max_discount_amount = ?');
      params.push(maxDiscountAmount);
    }
    if (usageLimit !== undefined) {
      updates.push('usage_limit = ?');
      params.push(usageLimit);
    }
    if (startDate !== undefined) {
      updates.push('start_date = ?');
      params.push(startDate);
    }
    if (endDate !== undefined) {
      updates.push('end_date = ?');
      params.push(endDate);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    if (updates.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE promotions SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }
    res.json({
      success: true,
      message: 'System promotion updated successfully.'
    });
  } catch (error) {
    console.error('Update system promotion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update promotion.'
    });
  }
};
const deleteSystemPromotion = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM coupons WHERE promotion_id = ?', [id]);
    const [result] = await pool.query(
      'DELETE FROM promotions WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found.'
      });
    }
    res.json({
      success: true,
      message: 'Promotion deleted successfully.'
    });
  } catch (error) {
    console.error('Delete system promotion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete promotion.'
    });
  }
};
module.exports = {
  getActivePromotions,
  validateCoupon,
  getShopPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  getAllPromotions,
  createSystemPromotion,
  updateSystemPromotion,
  deleteSystemPromotion
};
