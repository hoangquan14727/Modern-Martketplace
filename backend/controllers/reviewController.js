const { pool } = require('../config/database');
const { paginate, paginateResponse } = require('../utils/helpers');
const { sanitizePlainText } = require('../utils/sanitize');
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page, limit, rating } = req.query;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = "WHERE r.product_id = ? AND r.status = 'approved'";
    const params = [productId];
    if (rating) {
      whereClause += ' AND r.rating = ?';
      params.push(parseInt(rating));
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM reviews r ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [reviews] = await pool.query(
      `SELECT
        r.*,
        CASE WHEN r.is_anonymous = 1 THEN 'Ẩn danh' ELSE (c.first_name || ' ' || c.last_name) END as customer_name,
        CASE WHEN r.is_anonymous = 1 THEN NULL ELSE c.avatar END as customer_avatar
      FROM reviews r
      JOIN customers c ON r.customer_id = c.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(reviews, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reviews.'
    });
  }
};
const createReview = async (req, res) => {
  try {
    let { productId, order_id, rating, comment, images, isAnonymous } = req.body;
    comment = sanitizePlainText(comment, 2000);
    const [customers] = pool.query(
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
    if (order_id && !productId) {
      const [orderItems] = pool.query(
        'SELECT product_id FROM order_items WHERE order_id = ? LIMIT 1',
        [order_id]
      );
      if (orderItems.length > 0) {
        productId = orderItems[0].product_id;
      }
    }
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID or Order ID is required.'
      });
    }
    const [products] = pool.query(
      'SELECT id, shop_id FROM products WHERE id = ?',
      [productId]
    );
    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }
    let hasDeliveredOrder = false;
    if (order_id) {
      const [orders] = pool.query(
        `SELECT id FROM orders WHERE id = ? AND customer_id = ? AND status = 'delivered'`,
        [order_id, customerId]
      );
      hasDeliveredOrder = orders.length > 0;
    }
    if (!hasDeliveredOrder) {
      const [orderItems] = pool.query(
        `SELECT oi.id FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.customer_id = ? AND oi.product_id = ? AND o.status = 'delivered'`,
        [customerId, productId]
      );
      hasDeliveredOrder = orderItems.length > 0;
    }
    if (!hasDeliveredOrder) {
      return res.status(400).json({
        success: false,
        message: 'You can only review products from delivered orders.'
      });
    }
    const [existingReviews] = pool.query(
      'SELECT id FROM reviews WHERE customer_id = ? AND product_id = ?',
      [customerId, productId]
    );
    if (existingReviews.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product.'
      });
    }
    const [result] = pool.query(
      `INSERT INTO reviews (product_id, customer_id, order_id, rating, comment, images, is_anonymous)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [productId, customerId, order_id || null, rating, comment || null, images || null, isAnonymous ? 1 : 0]
    );
    const [ratingResult] = pool.query(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
       FROM reviews WHERE product_id = ? AND status = 'approved'`,
      [productId]
    );
    pool.query(
      'UPDATE products SET rating = ?, total_reviews = ? WHERE id = ?',
      [ratingResult[0].avg_rating || 0, ratingResult[0].total_reviews, productId]
    );
    const [shopRating] = pool.query(
      `SELECT AVG(r.rating) as avg_rating, COUNT(*) as total_reviews
       FROM reviews r
       JOIN products p ON r.product_id = p.id
       WHERE p.shop_id = ? AND r.status = 'approved'`,
      [products[0].shop_id]
    );
    pool.query(
      'UPDATE shops SET rating = ?, total_reviews = ? WHERE id = ?',
      [shopRating[0].avg_rating || 0, shopRating[0].total_reviews, products[0].shop_id]
    );
    res.status(201).json({
      success: true,
      message: 'Review submitted successfully.',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create review.'
    });
  }
};
const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment, images } = req.body;
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
    const [reviews] = await pool.query(
      'SELECT id, product_id FROM reviews WHERE id = ? AND customer_id = ?',
      [id, customers[0].id]
    );
    if (reviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.'
      });
    }
    const updates = [];
    const params = [];
    if (rating !== undefined) {
      updates.push('rating = ?');
      params.push(rating);
    }
    if (comment !== undefined) {
      updates.push('comment = ?');
      params.push(sanitizePlainText(comment, 2000));
    }
    if (images !== undefined) {
      updates.push('images = ?');
      params.push(JSON.stringify(images));
    }
    if (updates.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE reviews SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      const [ratingResult] = await pool.query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
         FROM reviews WHERE product_id = ? AND status = 'approved'`,
        [reviews[0].product_id]
      );
      await pool.query(
        'UPDATE products SET rating = ?, total_reviews = ? WHERE id = ?',
        [ratingResult[0].avg_rating || 0, ratingResult[0].total_reviews, reviews[0].product_id]
      );
    }
    res.json({
      success: true,
      message: 'Review updated successfully.'
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update review.'
    });
  }
};
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
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
    const [reviews] = await pool.query(
      'SELECT product_id FROM reviews WHERE id = ? AND customer_id = ?',
      [id, customers[0].id]
    );
    if (reviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.'
      });
    }
    await pool.query('DELETE FROM reviews WHERE id = ?', [id]);
    const [ratingResult] = await pool.query(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
       FROM reviews WHERE product_id = ? AND status = 'approved'`,
      [reviews[0].product_id]
    );
    await pool.query(
      'UPDATE products SET rating = ?, total_reviews = ? WHERE id = ?',
      [ratingResult[0].avg_rating || 0, ratingResult[0].total_reviews, reviews[0].product_id]
    );
    res.json({
      success: true,
      message: 'Review deleted successfully.'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete review.'
    });
  }
};
const getShopReviews = async (req, res) => {
  try {
    const { page, limit, rating, replied } = req.query;
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
    let whereClause = 'WHERE p.shop_id = ?';
    const params = [shopId];
    if (rating) {
      whereClause += ' AND r.rating = ?';
      params.push(parseInt(rating));
    }
    if (replied === 'true') {
      whereClause += ' AND r.shop_reply IS NOT NULL';
    } else if (replied === 'false') {
      whereClause += ' AND r.shop_reply IS NULL';
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM reviews r
       JOIN products p ON r.product_id = p.id
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [reviews] = await pool.query(
      `SELECT
        r.*,
        p.name as product_name,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as product_image,
        CASE WHEN r.is_anonymous = 1 THEN 'Anonymous' ELSE (c.first_name || ' ' || c.last_name) END as customer_name
      FROM reviews r
      JOIN products p ON r.product_id = p.id
      JOIN customers c ON r.customer_id = c.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(reviews, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get shop reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reviews.'
    });
  }
};
const replyToReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;
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
    const [reviews] = await pool.query(
      `SELECT r.id FROM reviews r
       JOIN products p ON r.product_id = p.id
       WHERE r.id = ? AND p.shop_id = ?`,
      [id, shops[0].id]
    );
    if (reviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.'
      });
    }
    await pool.query(
      "UPDATE reviews SET shop_reply = ?, shop_replied_at = datetime('now') WHERE id = ?",
      [reply, id]
    );
    res.json({
      success: true,
      message: 'Reply submitted successfully.'
    });
  } catch (error) {
    console.error('Reply to review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reply.'
    });
  }
};
const getAllReviews = async (req, res) => {
  try {
    const { page, limit, status, rating } = req.query;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (status) {
      whereClause += ' AND r.status = ?';
      params.push(status);
    }
    if (rating) {
      whereClause += ' AND r.rating = ?';
      params.push(parseInt(rating));
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM reviews r ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [reviews] = await pool.query(
      `SELECT
        r.*,
        p.name as product_name,
        s.shop_name,
        (c.first_name || ' ' || c.last_name) as customer_name
      FROM reviews r
      JOIN products p ON r.product_id = p.id
      JOIN shops s ON p.shop_id = s.id
      JOIN customers c ON r.customer_id = c.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(reviews, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get all reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reviews.'
    });
  }
};
const updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status.'
      });
    }
    const [result] = await pool.query(
      'UPDATE reviews SET status = ? WHERE id = ?',
      [status, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review not found.'
      });
    }
    res.json({
      success: true,
      message: 'Review status updated.'
    });
  } catch (error) {
    console.error('Update review status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update review status.'
    });
  }
};
const getMyReviews = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    const [customers] = pool.query(
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
    const [countResult] = pool.query(
      'SELECT COUNT(*) as total FROM reviews WHERE customer_id = ?',
      [customerId]
    );
    const total = countResult[0].total;
    const [reviews] = pool.query(
      `SELECT
        r.*,
        p.name as product_name,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as product_image
      FROM reviews r
      JOIN products p ON r.product_id = p.id
      WHERE r.customer_id = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?`,
      [customerId, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(reviews, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reviews.'
    });
  }
};
module.exports = {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
  getShopReviews,
  replyToReview,
  getAllReviews,
  updateReviewStatus,
  getMyReviews
};
