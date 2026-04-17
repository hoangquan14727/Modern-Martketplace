const { pool } = require('../config/database');
const getDashboard = async (req, res) => {
  try {
    const [userStats] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'customer') as total_customers,
        (SELECT COUNT(*) FROM users WHERE role = 'shop') as total_shops,
        (SELECT COUNT(*) FROM users WHERE role = 'admin') as total_admins,
        (SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', '-7 days')) as new_users_week
      `
    );
    const [shopStats] = await pool.query(
      `SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_shops,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_shops,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_shops
       FROM shops`
    );
    const [productStats] = await pool.query(
      `SELECT
        COUNT(*) as total_products,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_products,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_products
       FROM products`
    );
    const [orderStats] = await pool.query(
      `SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
       FROM orders`
    );
    const [revenueStats] = await pool.query(
      `SELECT
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN date(created_at) = date('now', 'localtime') THEN total_amount ELSE 0 END), 0) as today_revenue,
        COALESCE(SUM(CASE WHEN strftime('%Y-%W', created_at) = strftime('%Y-%W', 'now', 'localtime') THEN total_amount ELSE 0 END), 0) as week_revenue,
        COALESCE(SUM(CASE WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime') THEN total_amount ELSE 0 END), 0) as month_revenue
       FROM orders WHERE status = 'delivered'`
    );
    const [supportStats] = await pool.query(
      `SELECT
        SUM(CASE WHEN status IN ('open', 'in_progress', 'waiting_customer') THEN 1 ELSE 0 END) as open_tickets,
        SUM(CASE WHEN priority = 'urgent' AND status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END) as urgent_tickets
       FROM support_tickets`
    );
    const [recentOrders] = await pool.query(
      `SELECT o.id, o.order_number, o.total_amount, o.status, o.created_at,
        s.shop_name,
        c.first_name || ' ' || c.last_name as customer_name
       FROM orders o
       JOIN shops s ON o.shop_id = s.id
       JOIN customers c ON o.customer_id = c.id
       ORDER BY o.created_at DESC
       LIMIT 10`
    );
    const [dailyRevenue] = await pool.query(
      `SELECT date(created_at) as date, SUM(total_amount) as revenue, COUNT(*) as orders
       FROM orders WHERE status = 'delivered' AND created_at >= datetime('now', '-30 days')
       GROUP BY date(created_at)
       ORDER BY date ASC`
    );
    const [topShops] = await pool.query(
      `SELECT s.id, s.shop_name, s.logo, s.rating,
        COUNT(o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_revenue
       FROM shops s
       LEFT JOIN orders o ON s.id = o.shop_id AND o.status = 'delivered'
       WHERE s.status = 'approved'
       GROUP BY s.id
       ORDER BY total_revenue DESC
       LIMIT 5`
    );
    res.json({
      success: true,
      data: {
        users: userStats[0],
        shops: shopStats[0],
        products: productStats[0],
        orders: orderStats[0],
        revenue: revenueStats[0],
        support: supportStats[0],
        recentOrders,
        dailyRevenue,
        topShops
      }
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard.'
    });
  }
};
const getReports = async (req, res) => {
  try {
    const { type, startDate, endDate, groupBy } = req.query;
    let dateFilter = '';
    const params = [];
    if (startDate && endDate) {
      dateFilter = 'AND date(created_at) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    let data = {};
    if (type === 'revenue' || !type) {
      let groupByClause = 'date(created_at)';
      if (groupBy === 'week') {
        groupByClause = "strftime('%Y-%W', created_at)";
      } else if (groupBy === 'month') {
        groupByClause = "strftime('%Y-%m', created_at)";
      }
      const [revenue] = await pool.query(
        `SELECT
          ${groupByClause} as period,
          COUNT(*) as orders,
          SUM(total_amount) as revenue,
          SUM(discount_amount) as discounts,
          AVG(total_amount) as avg_order_value
         FROM orders
         WHERE status = 'delivered' ${dateFilter}
         GROUP BY ${groupByClause}
         ORDER BY period DESC`,
        params
      );
      data.revenue = revenue;
    }
    if (type === 'orders' || !type) {
      const [ordersByStatus] = await pool.query(
        `SELECT status, COUNT(*) as count
         FROM orders
         WHERE 1=1 ${dateFilter}
         GROUP BY status`,
        params
      );
      const [ordersByPayment] = await pool.query(
        `SELECT payment_method, COUNT(*) as count
         FROM orders
         WHERE 1=1 ${dateFilter}
         GROUP BY payment_method`,
        params
      );
      data.orders = { byStatus: ordersByStatus, byPayment: ordersByPayment };
    }
    if (type === 'products' || !type) {
      const [topProducts] = await pool.query(
        `SELECT p.id, p.name, p.sold_quantity, p.rating,
          s.shop_name,
          (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
         FROM products p
         JOIN shops s ON p.shop_id = s.id
         ORDER BY p.sold_quantity DESC
         LIMIT 20`
      );
      const [productsByCategory] = await pool.query(
        `SELECT c.name as category, COUNT(p.id) as count
         FROM categories c
         LEFT JOIN products p ON c.id = p.category_id
         GROUP BY c.id
         ORDER BY count DESC`
      );
      data.products = { topSelling: topProducts, byCategory: productsByCategory };
    }
    if (type === 'customers' || !type) {
      const [topCustomers] = await pool.query(
        `SELECT c.id, c.first_name, c.last_name, c.membership_level,
          u.email,
          COUNT(o.id) as total_orders,
          COALESCE(SUM(o.total_amount), 0) as total_spent
         FROM customers c
         JOIN users u ON c.user_id = u.id
         LEFT JOIN orders o ON c.id = o.customer_id AND o.status = 'delivered'
         GROUP BY c.id
         ORDER BY total_spent DESC
         LIMIT 20`
      );
      data.customers = { top: topCustomers };
    }
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reports.'
    });
  }
};
const getFinance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = '';
    const params = [];
    if (startDate && endDate) {
      dateFilter = 'AND date(created_at) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    const [revenue] = await pool.query(
      `SELECT
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(shipping_fee), 0) as total_shipping,
        COALESCE(SUM(discount_amount), 0) as total_discount,
        COUNT(*) as total_orders
       FROM orders
       WHERE status = 'delivered' ${dateFilter}`,
      params
    );
    const [transactions] = await pool.query(
      `SELECT t.*, u.email as user_email
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       WHERE 1=1 ${dateFilter.replace('created_at', 't.created_at')}
       ORDER BY t.created_at DESC
       LIMIT 50`,
      params
    );
    const [shopBalances] = await pool.query(
      `SELECT s.id, s.shop_name, s.wallet_balance,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE shop_id = s.id AND status = 'delivered') as total_revenue
       FROM shops s
       WHERE s.status = 'approved'
       ORDER BY s.wallet_balance DESC
       LIMIT 20`
    );
    res.json({
      success: true,
      data: {
        revenue: revenue[0],
        transactions,
        shopBalances
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
const getPendingCounts = async (req, res) => {
  try {
    const [counts] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM shops WHERE status = 'pending') as pending_shops,
        (SELECT COUNT(*) FROM products WHERE status = 'pending') as pending_products,
        (SELECT COUNT(*) FROM reviews WHERE status = 'pending') as pending_reviews,
        (SELECT COUNT(*) FROM support_tickets WHERE status IN ('open', 'in_progress')) as open_tickets
      `
    );
    res.json({
      success: true,
      data: counts[0]
    });
  } catch (error) {
    console.error('Get pending counts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get counts.'
    });
  }
};
module.exports = {
  getDashboard,
  getReports,
  getFinance,
  getPendingCounts
};
