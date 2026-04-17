const { pool } = require('../config/database');
const { paginate, paginateResponse } = require('../utils/helpers');
const getProfile = async (req, res) => {
  try {
    const [shops] = await pool.query(
      `SELECT s.*, u.email, u.created_at as account_created
       FROM shops s
       JOIN users u ON s.user_id = u.id
       WHERE s.user_id = ?`,
      [req.user.id]
    );
    if (shops.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found.'
      });
    }
    res.json({
      success: true,
      data: shops[0]
    });
  } catch (error) {
    console.error('Get shop profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile.'
    });
  }
};
const updateProfile = async (req, res) => {
  try {
    const {
      shopName,
      description,
      logo,
      banner,
      phone,
      email,
      province,
      district,
      ward,
      streetAddress
    } = req.body;
    const updates = [];
    const params = [];
    if (shopName !== undefined) {
      updates.push('shop_name = ?');
      params.push(shopName);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (logo !== undefined) {
      updates.push('logo = ?');
      params.push(logo);
    }
    if (banner !== undefined) {
      updates.push('banner = ?');
      params.push(banner);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    if (province !== undefined) {
      updates.push('province = ?');
      params.push(province);
    }
    if (district !== undefined) {
      updates.push('district = ?');
      params.push(district);
    }
    if (ward !== undefined) {
      updates.push('ward = ?');
      params.push(ward);
    }
    if (streetAddress !== undefined) {
      updates.push('street_address = ?');
      params.push(streetAddress);
    }
    if (updates.length > 0) {
      params.push(req.user.id);
      await pool.query(
        `UPDATE shops SET ${updates.join(', ')} WHERE user_id = ?`,
        params
      );
    }
    res.json({
      success: true,
      message: 'Profile updated successfully.'
    });
  } catch (error) {
    console.error('Update shop profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile.'
    });
  }
};
const getDashboard = async (req, res) => {
  try {
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
    const [orderStats] = await pool.query(
      `SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_orders,
        SUM(CASE WHEN status = 'shipping' THEN 1 ELSE 0 END) as shipping_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
      FROM orders WHERE shop_id = ?`,
      [shopId]
    );
    const [revenueStats] = await pool.query(
      `SELECT
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN DATE(created_at) = DATE('now') THEN total_amount ELSE 0 END), 0) as today_revenue,
        COALESCE(SUM(CASE WHEN created_at >= DATE('now', '-7 days') THEN total_amount ELSE 0 END), 0) as week_revenue,
        COALESCE(SUM(CASE WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') THEN total_amount ELSE 0 END), 0) as month_revenue
      FROM orders WHERE shop_id = ? AND status = 'delivered'`,
      [shopId]
    );
    const [productStats] = await pool.query(
      `SELECT
        COUNT(*) as total_products,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_products,
        SUM(CASE WHEN status = 'approved' AND is_active = 1 THEN 1 ELSE 0 END) as active_products,
        SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock
      FROM products WHERE shop_id = ?`,
      [shopId]
    );
    const [reviewStats] = await pool.query(
      `SELECT
        COUNT(*) as total_reviews,
        AVG(r.rating) as average_rating,
        SUM(CASE WHEN r.shop_reply IS NULL THEN 1 ELSE 0 END) as pending_replies
      FROM reviews r
      JOIN products p ON r.product_id = p.id
      WHERE p.shop_id = ?`,
      [shopId]
    );
    const [recentOrders] = await pool.query(
      `SELECT
        o.id,
        o.order_number,
        o.total_amount,
        o.status,
        o.created_at,
        c.first_name,
        c.last_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.shop_id = ?
      ORDER BY o.created_at DESC
      LIMIT 5`,
      [shopId]
    );
    const [topProducts] = await pool.query(
      `SELECT
        p.id,
        p.name,
        p.sold_quantity,
        p.rating,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
      FROM products p
      WHERE p.shop_id = ?
      ORDER BY p.sold_quantity DESC
      LIMIT 5`,
      [shopId]
    );
    res.json({
      success: true,
      data: {
        orders: orderStats[0],
        revenue: revenueStats[0],
        products: productStats[0],
        reviews: reviewStats[0],
        recentOrders,
        topProducts
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard.'
    });
  }
};
const getShopPublic = async (req, res) => {
  try {
    const { id } = req.params;
    const [shops] = await pool.query(
      `SELECT
        s.id, s.shop_name, s.slug, s.description, s.logo, s.banner,
        s.rating, s.total_reviews, s.created_at,
        (SELECT COUNT(*) FROM products WHERE shop_id = s.id AND status = 'approved' AND is_active = 1) as total_products,
        (SELECT COALESCE(SUM(sold_quantity), 0) FROM products WHERE shop_id = s.id) as total_sold
      FROM shops s
      WHERE (s.id = ? OR s.slug = ?) AND s.status = 'approved'`,
      [id, id]
    );
    if (shops.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found.'
      });
    }
    res.json({
      success: true,
      data: shops[0]
    });
  } catch (error) {
    console.error('Get shop public error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get shop.'
    });
  }
};
const getShops = async (req, res) => {
  try {
    const { page, limit, search, sort } = req.query;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = "WHERE status = 'approved'";
    const params = [];
    if (search) {
      whereClause += ' AND (shop_name LIKE ? OR description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }
    let orderClause = 'ORDER BY created_at DESC';
    if (sort === 'rating') {
      orderClause = 'ORDER BY rating DESC';
    } else if (sort === 'products') {
      orderClause = 'ORDER BY total_products DESC';
    } else if (sort === 'sold') {
      orderClause = 'ORDER BY total_sold DESC';
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM shops ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [shops] = await pool.query(
      `SELECT
        id, shop_name, slug, description, logo,
        rating, total_reviews, total_products, total_sold
      FROM shops
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(shops, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get shops error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get shops.'
    });
  }
};
const getAllShops = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (search) {
      whereClause += ' AND (s.shop_name LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }
    if (status) {
      whereClause += ' AND s.status = ?';
      params.push(status);
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM shops s
       JOIN users u ON s.user_id = u.id
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [shops] = await pool.query(
      `SELECT
        s.*,
        u.email,
        u.email as owner_name,
        u.status as account_status,
        (SELECT COUNT(*) FROM orders WHERE shop_id = s.id) as total_orders,
        (SELECT SUM(total_amount) FROM orders WHERE shop_id = s.id AND status = 'delivered') as total_revenue
      FROM shops s
      JOIN users u ON s.user_id = u.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(shops, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get all shops error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get shops.'
    });
  }
};
const updateShopStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status.'
      });
    }
    const [result] = await pool.query(
      'UPDATE shops SET status = ? WHERE id = ?',
      [status, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found.'
      });
    }
    res.json({
      success: true,
      message: 'Shop status updated.'
    });
  } catch (error) {
    console.error('Update shop status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update shop status.'
    });
  }
};
const getFinance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const [shops] = await pool.query(
      'SELECT id, wallet_balance FROM shops WHERE user_id = ?',
      [req.user.id]
    );
    if (shops.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found.'
      });
    }
    const shopId = shops[0].id;
    let dateFilter = '';
    const params = [shopId];
    if (startDate && endDate) {
      dateFilter = 'AND DATE(created_at) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    const [revenue] = await pool.query(
      `SELECT
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(shipping_fee), 0) as total_shipping,
        COALESCE(SUM(discount_amount), 0) as total_discount,
        COUNT(*) as total_orders
      FROM orders
      WHERE shop_id = ? AND status = 'delivered' ${dateFilter}`,
      params
    );
    const [dailyRevenue] = await pool.query(
      `SELECT
        DATE(created_at) as date,
        SUM(total_amount) as revenue,
        COUNT(*) as orders
      FROM orders
      WHERE shop_id = ? AND status = 'delivered' ${dateFilter}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30`,
      params
    );
    const [transactions] = await pool.query(
      `SELECT * FROM transactions
       WHERE user_id = (SELECT user_id FROM shops WHERE id = ?)
       ORDER BY created_at DESC
       LIMIT 20`,
      [shopId]
    );
    res.json({
      success: true,
      data: {
        wallet_balance: shops[0].wallet_balance,
        revenue: revenue[0],
        dailyRevenue,
        transactions
      }
    });
  } catch (error) {
    console.error('Get finance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get finance.'
    });
  }
};
module.exports = {
  getProfile,
  updateProfile,
  getDashboard,
  getShopPublic,
  getShops,
  getAllShops,
  updateShopStatus,
  getFinance
};
