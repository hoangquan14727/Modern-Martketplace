const { pool } = require('../config/database');
const { paginate, paginateResponse, generateOrderNumber } = require('../utils/helpers');
const { createNotification } = require('./notificationController');
const createOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { shopId, addressId, paymentMethod, note, couponCode } = req.body;
    const [customers] = await connection.query(
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
    const [addresses] = await connection.query(
      'SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?',
      [addressId, customerId]
    );
    if (addresses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Address not found.'
      });
    }
    const address = addresses[0];
    const [carts] = await connection.query(
      'SELECT id FROM carts WHERE customer_id = ?',
      [customerId]
    );
    if (carts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found.'
      });
    }
    const cartId = carts[0].id;
    const [cartItems] = await connection.query(
      `SELECT
        ci.*,
        p.name as product_name,
        p.price,
        p.stock_quantity,
        p.is_active,
        p.status as product_status,
        p.shop_id,
        pv.name as variant_name,
        pv.price as variant_price,
        pv.stock_quantity as variant_stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN product_variants pv ON ci.variant_id = pv.id
      WHERE ci.cart_id = ? AND p.shop_id = ?`,
      [cartId, shopId]
    );
    if (cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items in cart for this shop.'
      });
    }
    await connection.beginTransaction();
    let subtotal = 0;
    const orderItems = [];
    for (const item of cartItems) {
      if (!item.is_active || item.product_status !== 'approved') {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Product "${item.product_name}" is no longer available.`
        });
      }
      const actualStock = item.variant_id ? item.variant_stock : item.stock_quantity;
      const actualPrice = item.variant_price || item.price;
      if (item.quantity > actualStock) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${item.product_name}". Only ${actualStock} available.`
        });
      }
      const itemTotal = actualPrice * item.quantity;
      subtotal += itemTotal;
      orderItems.push({
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product_name,
        variant_name: item.variant_name,
        price: actualPrice,
        quantity: item.quantity,
        total: itemTotal
      });
    }
    const shippingFee = 30000; 
    let discountAmount = 0;
    let couponId = null;
    if (couponCode) {
      const [coupons] = await connection.query(
        `SELECT c.*, p.type, p.value, p.min_order_amount, p.max_discount_amount, p.usage_limit, p.used_count
         FROM coupons c
         JOIN promotions p ON c.promotion_id = p.id
         WHERE UPPER(c.code) = UPPER(?) AND c.is_active = 1
         AND p.is_active = 1
         AND p.start_date <= datetime('now')
         AND p.end_date >= datetime('now')
         AND (p.shop_id = ? OR p.shop_id IS NULL)`,
        [couponCode, shopId]
      );
      if (coupons.length > 0) {
        const coupon = coupons[0];
        if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Coupon has reached usage limit.'
          });
        }
        if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Minimum order amount for this coupon is ${coupon.min_order_amount}.`
          });
        }
        const [usage] = await connection.query(
          'SELECT id FROM coupon_usage WHERE coupon_id = ? AND customer_id = ?',
          [coupon.id, customerId]
        );
        if (usage.length > 0) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'You have already used this coupon.'
          });
        }
        if (coupon.type === 'percentage') {
          discountAmount = (subtotal * coupon.value) / 100;
        } else if (coupon.type === 'fixed_amount') {
          discountAmount = coupon.value;
        } else if (coupon.type === 'free_shipping') {
          discountAmount = shippingFee;
        }
        if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
          discountAmount = coupon.max_discount_amount;
        }
        couponId = coupon.id;
      }
    }
    const totalAmount = subtotal + shippingFee - discountAmount;
    const orderNumber = generateOrderNumber();
    const shippingAddress = JSON.stringify({
      recipient_name: address.recipient_name,
      phone: address.phone,
      province: address.province,
      district: address.district,
      ward: address.ward,
      street_address: address.street_address
    });
    const [orderResult] = await connection.query(
      `INSERT INTO orders
       (order_number, customer_id, shop_id, status, payment_method, subtotal, shipping_fee, discount_amount, total_amount, shipping_address, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, customerId, shopId, 'pending', paymentMethod || 'cod', subtotal, shippingFee, discountAmount, totalAmount, shippingAddress, note || null]
    );
    const orderId = orderResult.insertId;
    for (const item of orderItems) {
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_name, price, quantity, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.variant_id, item.product_name, item.variant_name, item.price, item.quantity, item.total]
      );
      if (item.variant_id) {
        const [variantRes] = await connection.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?',
          [item.quantity, item.variant_id, item.quantity]
        );
        if (!variantRes.affectedRows) {
          await connection.rollback();
          return res.status(409).json({
            success: false,
            message: `Insufficient stock for "${item.product_name}" (variant). Please try again.`
          });
        }
      } else {
        const [productRes] = await connection.query(
          'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?',
          [item.quantity, item.product_id, item.quantity]
        );
        if (!productRes.affectedRows) {
          await connection.rollback();
          return res.status(409).json({
            success: false,
            message: `Insufficient stock for "${item.product_name}". Please try again.`
          });
        }
      }
      await connection.query(
        'UPDATE products SET sold_quantity = sold_quantity + ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }
    if (couponId) {
      await connection.query(
        'INSERT INTO coupon_usage (coupon_id, customer_id, order_id, discount_amount) VALUES (?, ?, ?, ?)',
        [couponId, customerId, orderId, discountAmount]
      );
      const [couponRes] = await connection.query(
        `UPDATE promotions
            SET used_count = used_count + 1
          WHERE id = (SELECT promotion_id FROM coupons WHERE id = ?)
            AND (usage_limit IS NULL OR used_count < usage_limit)`,
        [couponId]
      );
      if (!couponRes.affectedRows) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: 'Coupon has just reached its usage limit. Please try another.'
        });
      }
    }
    await connection.query(
      'INSERT INTO order_tracking (order_id, status, description) VALUES (?, ?, ?)',
      [orderId, 'Order Placed', 'Your order has been placed successfully']
    );
    await connection.query(
      `DELETE ci FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = ? AND p.shop_id = ?`,
      [cartId, shopId]
    );
    await connection.query(
      'UPDATE shops SET total_sold = total_sold + 1 WHERE id = ?',
      [shopId]
    );
    await connection.commit();
    res.status(201).json({
      success: true,
      message: 'Order created successfully.',
      data: {
        order_id: orderId,
        order_number: orderNumber,
        total_amount: totalAmount
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order.'
    });
  } finally {
    connection.release();
  }
};
const getCustomerOrders = async (req, res) => {
  try {
    const { page, limit, status } = req.query;
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
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = 'WHERE o.customer_id = ?';
    const params = [customerId];
    if (status) {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [orders] = await pool.query(
      `SELECT
        o.*,
        s.shop_name,
        s.logo as shop_logo,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      JOIN shops s ON o.shop_id = s.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    for (const order of orders) {
      const [items] = await pool.query(
        `SELECT
          oi.product_name,
          (SELECT image_url FROM product_images WHERE product_id = oi.product_id AND is_primary = 1 LIMIT 1) as image
        FROM order_items oi
        WHERE oi.order_id = ?
        LIMIT 1`,
        [order.id]
      );
      order.first_item = items[0] || null;
    }
    res.json({
      success: true,
      ...paginateResponse(orders, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get customer orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get orders.'
    });
  }
};
const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    let whereClause = 'WHERE (o.id = ? OR o.order_number = ?)';
    const params = [id, id];
    if (req.user.role === 'customer') {
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
      whereClause += ' AND o.customer_id = ?';
      params.push(customers[0].id);
    } else if (req.user.role === 'shop') {
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
      whereClause += ' AND o.shop_id = ?';
      params.push(shops[0].id);
    }
    const [orders] = await pool.query(
      `SELECT
        o.*,
        s.shop_name,
        s.logo as shop_logo,
        s.phone as shop_phone,
        c.first_name as customer_first_name,
        c.last_name as customer_last_name
      FROM orders o
      JOIN shops s ON o.shop_id = s.id
      JOIN customers c ON o.customer_id = c.id
      ${whereClause}`,
      params
    );
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }
    const order = orders[0];
    const [items] = await pool.query(
      `SELECT
        oi.*,
        (SELECT image_url FROM product_images WHERE product_id = oi.product_id AND is_primary = 1 LIMIT 1) as image
      FROM order_items oi
      WHERE oi.order_id = ?`,
      [order.id]
    );
    const [tracking] = await pool.query(
      'SELECT * FROM order_tracking WHERE order_id = ? ORDER BY created_at DESC',
      [order.id]
    );
    let shippingAddress = order.shipping_address;
    try {
        shippingAddress = JSON.parse(order.shipping_address);
    } catch (e) {
    }
    res.json({
      success: true,
      data: {
        ...order,
        shipping_address: shippingAddress,
        items,
        tracking
      }
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get order.'
    });
  }
};
const getShopOrders = async (req, res) => {
  try {
    const { page, limit, status, search } = req.query;
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
    let whereClause = 'WHERE o.shop_id = ?';
    const params = [shopId];
    if (status) {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }
    if (search) {
      whereClause += ' AND (o.order_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM orders o
       JOIN customers c ON o.customer_id = c.id
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [orders] = await pool.query(
      `SELECT
        o.*,
        c.first_name as customer_first_name,
        c.last_name as customer_last_name,
        (c.first_name || ' ' || c.last_name) as customer_name,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(orders, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get shop orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get orders.'
    });
  }
};
const updateOrderStatus = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { status, trackingDescription, location } = req.body;
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
    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE id = ? AND shop_id = ?',
      [id, shopId]
    );
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }
    const order = orders[0];
    const validTransitions = {
      pending: ['confirmed', 'processing', 'shipping', 'cancelled'],
      confirmed: ['processing', 'shipping', 'cancelled'],
      processing: ['shipping', 'cancelled'],
      shipping: ['delivered'],
      delivered: ['refunded'],
      cancelled: [],
      refunded: []
    };
    if (!validTransitions[order.status] || !validTransitions[order.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${order.status} to ${status}.`
      });
    }
    const updateFields = ['status = ?'];
    const updateParams = [status];
    if (status === 'confirmed') {
      updateFields.push("confirmed_at = datetime('now')");
    } else if (status === 'shipping') {
      updateFields.push("shipped_at = datetime('now')");
    } else if (status === 'delivered') {
      updateFields.push("delivered_at = datetime('now')");
      updateFields.push("payment_status = 'paid'");
    } else if (status === 'cancelled') {
      updateFields.push("cancelled_at = datetime('now')");
      updateFields.push("cancelled_by = 'shop'");
    }
    updateParams.push(id);
    await connection.beginTransaction();
    await connection.query(
      `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );
    const trackingMap = {
      confirmed: 'Order Confirmed',
      processing: 'Order Processing',
      shipping: 'Order Shipped',
      delivered: 'Order Delivered',
      cancelled: 'Order Cancelled'
    };
    await connection.query(
      'INSERT INTO order_tracking (order_id, status, description, location) VALUES (?, ?, ?, ?)',
      [id, trackingMap[status], trackingDescription || null, location || null]
    );
    if (status === 'cancelled') {
      const [items] = await connection.query(
        'SELECT * FROM order_items WHERE order_id = ?',
        [id]
      );
      for (const item of items) {
        if (item.variant_id) {
          await connection.query(
            'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
            [item.quantity, item.variant_id]
          );
        } else {
          await connection.query(
            'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
            [item.quantity, item.product_id]
          );
        }
        await connection.query(
          'UPDATE products SET sold_quantity = sold_quantity - ? WHERE id = ? AND sold_quantity >= ?',
          [item.quantity, item.product_id, item.quantity]
        );
      }
    }
    await connection.commit();
    if (status === 'delivered') {
      const [orderData] = await pool.query(
        `SELECT o.order_number, c.user_id, c.first_name
         FROM orders o
         JOIN customers c ON o.customer_id = c.id
         WHERE o.id = ?`,
        [id]
      );
      if (orderData.length > 0) {
        const customerUserId = orderData[0].user_id;
        const orderNumber = orderData[0].order_number;
        const firstName = orderData[0].first_name;
        const [orderItems] = await pool.query(
          'SELECT product_name FROM order_items WHERE order_id = ? LIMIT 3',
          [id]
        );
        const productNames = orderItems.map(i => i.product_name).join(', ');
        createNotification(
          customerUserId,
          '📦 Order Delivered - Please Review!',
          `Hi ${firstName}! Your order #${orderNumber} has been delivered. We'd love to hear your feedback! Rate your products: ${productNames}`,
          'review',
          { order_id: id, order_number: orderNumber }
        );
      }
    }
    res.json({
      success: true,
      message: 'Order status updated successfully.'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status.'
    });
  } finally {
    connection.release();
  }
};
const cancelOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const [customers] = await connection.query(
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
    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }
    const order = orders[0];
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage.'
      });
    }
    await connection.beginTransaction();
    await connection.query(
      `UPDATE orders SET status = 'cancelled', cancelled_at = datetime('now'), cancelled_by = 'customer', cancelled_reason = ? WHERE id = ?`,
      [reason || null, id]
    );
    await connection.query(
      'INSERT INTO order_tracking (order_id, status, description) VALUES (?, ?, ?)',
      [id, 'Order Cancelled', reason || 'Cancelled by customer']
    );
    const [items] = await connection.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [id]
    );
    for (const item of items) {
      if (item.variant_id) {
        await connection.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
          [item.quantity, item.variant_id]
        );
      } else {
        await connection.query(
          'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
      await connection.query(
        'UPDATE products SET sold_quantity = sold_quantity - ? WHERE id = ? AND sold_quantity >= ?',
        [item.quantity, item.product_id, item.quantity]
      );
    }
    await connection.commit();
    res.json({
      success: true,
      message: 'Order cancelled successfully.'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order.'
    });
  } finally {
    connection.release();
  }
};
const getAllOrders = async (req, res) => {
  try {
    const { page, limit, status, shop_id, search } = req.query;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (status) {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }
    if (shop_id) {
      whereClause += ' AND o.shop_id = ?';
      params.push(shop_id);
    }
    if (search) {
      whereClause += ' AND (o.order_number LIKE ? OR s.shop_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM orders o
       JOIN shops s ON o.shop_id = s.id
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [orders] = await pool.query(
      `SELECT
        o.*,
        s.shop_name,
        c.first_name as customer_first_name,
        c.last_name as customer_last_name
      FROM orders o
      JOIN shops s ON o.shop_id = s.id
      JOIN customers c ON o.customer_id = c.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(orders, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get orders.'
    });
  }
};
const createOrderDirect = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { items, shippingAddress, paymentMethod, note, couponCode } = req.body;
    const [customers] = await connection.query(
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
    const itemsByShop = {};
    for (const item of items) {
      const [products] = await pool.query(
        `SELECT p.*, s.shop_name, s.id as shop_id
         FROM products p
         JOIN shops s ON p.shop_id = s.id
         WHERE p.id = ? AND p.is_active = 1 AND p.status = 'approved'`,
        [item.id]
      );
      if (products.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Product "${item.name}" is no longer available.`
        });
      }
      const product = products[0];
      if (item.quantity > product.stock_quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Only ${product.stock_quantity} available.`
        });
      }
      if (!itemsByShop[product.shop_id]) {
        itemsByShop[product.shop_id] = {
          shopId: product.shop_id,
          shopName: product.shop_name,
          items: []
        };
      }
      itemsByShop[product.shop_id].items.push({
        productId: product.id,
        productName: product.name,
        price: parseFloat(product.price),
        quantity: item.quantity,
        total: parseFloat(product.price) * item.quantity
      });
    }
    // Validate coupon if provided
    let couponDiscount = 0;
    if (couponCode) {
      try {
        const [coupons] = await pool.query(
          `SELECT c.*, p.type, p.value, p.min_order_amount, p.max_discount_amount, p.shop_id as promo_shop_id
           FROM coupons c
           JOIN promotions p ON c.promotion_id = p.id
           WHERE UPPER(c.code) = UPPER(?) AND c.is_active = 1
           AND p.is_active = 1 AND p.start_date <= datetime('now') AND p.end_date >= datetime('now')`,
          [couponCode]
        );
        if (coupons.length > 0) {
          const coupon = coupons[0];
          const orderTotal = Object.values(itemsByShop).reduce((s, shop) => s + shop.items.reduce((ss, i) => ss + i.total, 0), 0);
          if (!coupon.min_order_amount || orderTotal >= coupon.min_order_amount) {
            if (coupon.type === 'percentage') couponDiscount = (orderTotal * coupon.value) / 100;
            else if (coupon.type === 'fixed_amount') couponDiscount = coupon.value;
            if (coupon.max_discount_amount && couponDiscount > coupon.max_discount_amount) couponDiscount = coupon.max_discount_amount;
          }
        }
      } catch(e) { /* coupon validation failed, proceed without discount */ }
    }

    const createdOrders = [];
    const shopCount = Object.keys(itemsByShop).length;
    const discountPerShop = Math.floor(couponDiscount / shopCount);

    await connection.beginTransaction();
    for (const shopId in itemsByShop) {
      const shopData = itemsByShop[shopId];
      const subtotal = shopData.items.reduce((sum, item) => sum + item.total, 0);
      const shippingFee = 30000;
      const totalAmount = subtotal + shippingFee - discountPerShop;
      const orderNumber = generateOrderNumber();
      const addressJson = JSON.stringify(shippingAddress);

      const [orderResult] = await connection.query(
        `INSERT INTO orders
         (order_number, customer_id, shop_id, subtotal, shipping_fee, discount_amount, total_amount,
          shipping_address, payment_method, note, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderNumber,
          customerId,
          parseInt(shopId),
          subtotal,
          shippingFee,
          discountPerShop,
          totalAmount,
          addressJson,
          paymentMethod || 'cod',
          note || null,
          'pending'
        ]
      );
      const orderId = orderResult.insertId;
      for (const item of shopData.items) {
        await connection.query(
          `INSERT INTO order_items (order_id, product_id, product_name, price, quantity, total)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, item.productId, item.productName, item.price, item.quantity, item.total]
        );
        const [stockRes] = await connection.query(
          'UPDATE products SET stock_quantity = stock_quantity - ?, sold_quantity = sold_quantity + ? WHERE id = ? AND stock_quantity >= ?',
          [item.quantity, item.quantity, item.productId, item.quantity]
        );
        if (!stockRes.affectedRows) {
          await connection.rollback();
          return res.status(409).json({
            success: false,
            message: `Insufficient stock for "${item.productName}". Please try again.`
          });
        }
      }
      createdOrders.push({
        id: orderId,
        orderNumber,
        shopName: shopData.shopName,
        totalAmount
      });
    }
    await connection.commit();
    res.status(201).json({
      success: true,
      message: `${createdOrders.length} order(s) created successfully.`,
      data: { orders: createdOrders }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create order direct error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order: ' + error.message
    });
  } finally {
    connection.release();
  }
};
const downloadInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const InvoiceService = require('../services/invoiceService');
    let whereClause = 'WHERE (o.id = ? OR o.order_number = ?)';
    const params = [id, id];
    if (req.user.role === 'customer') {
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
      whereClause += ' AND o.customer_id = ?';
      params.push(customers[0].id);
    } else if (req.user.role === 'shop') {
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
      whereClause += ' AND o.shop_id = ?';
      params.push(shops[0].id);
    }
    const [orders] = await pool.query(
      `SELECT
        o.*,
        c.first_name,
        c.last_name,
        c.email,
        c.phone
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      ${whereClause}`,
      params
    );
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }
    const order = orders[0];
    const [items] = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [order.id]
    );
    const pdfBuffer = await InvoiceService.generateInvoicePDF(order, order, items);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Download invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice.'
    });
  }
};
const getDetailedTracking = async (req, res) => {
  try {
    const { id } = req.params; 
    const db = require('../config/database');
    let orderQuery = 'SELECT * FROM orders WHERE (id = ? OR order_number = ?)';
    const params = [id, id];
    if (req.user && req.user.role === 'customer') {
      const customer = db.prepare('SELECT id FROM customers WHERE user_id = ?').get(req.user.id);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found.'
        });
      }
      orderQuery += ' AND customer_id = ?';
      params.push(customer.id);
    } else if (req.user && req.user.role === 'shop') {
      const shop = db.prepare('SELECT id FROM shops WHERE user_id = ?').get(req.user.id);
      if (!shop) {
        return res.status(404).json({
          success: false,
          message: 'Shop not found.'
        });
      }
      orderQuery += ' AND shop_id = ?';
      params.push(shop.id);
    }
    const order = db.prepare(orderQuery).get(...params);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }
    const tracking = db.prepare(`
      SELECT * FROM order_tracking 
      WHERE order_id = ? 
      ORDER BY created_at ASC
    `).all(order.id);
    const shop = db.prepare('SELECT shop_name, phone FROM shops WHERE id = ?').get(order.shop_id);
    let estimatedDelivery = null;
    if (order.shipped_at) {
      const shippedDate = new Date(order.shipped_at);
      const deliveryDate = new Date(shippedDate);
      deliveryDate.setDate(deliveryDate.getDate() + 4); 
      estimatedDelivery = deliveryDate.toISOString();
    }
    res.json({
      success: true,
      data: {
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        created_at: order.created_at,
        shipped_at: order.shipped_at,
        delivered_at: order.delivered_at,
        estimated_delivery: estimatedDelivery,
        shipping_address: JSON.parse(order.shipping_address),
        shop: {
          name: shop.shop_name,
          phone: shop.phone
        },
        tracking: tracking.map(t => ({
          status: t.status,
          description: t.description,
          location: t.location,
          timestamp: t.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Get detailed tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tracking information.'
    });
  }
};
const updateTrackingLocation = async (req, res) => {
  try {
    const { id } = req.params; 
    const { location, description } = req.body;
    const db = require('../config/database');
    if (!location || !description) {
      return res.status(400).json({
        success: false,
        message: 'Location and description are required.'
      });
    }
    const shop = db.prepare('SELECT id FROM shops WHERE user_id = ?').get(req.user.id);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found.'
      });
    }
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND shop_id = ?').get(id, shop.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }
    if (order.status !== 'shipping') {
      return res.status(400).json({
        success: false,
        message: 'Can only add tracking for orders in shipping status.'
      });
    }
    db.prepare(`
      INSERT INTO order_tracking (order_id, status, description, location)
      VALUES (?, 'In Transit', ?, ?)
    `).run(id, description, location);
    db.prepare(`
      UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(id);
    const customer = db.prepare(`
      SELECT user_id, first_name FROM customers WHERE id = ?
    `).get(order.customer_id);
    if (customer) {
      const { createNotification } = require('./notificationController');
      createNotification(
        customer.user_id,
        '📍 Shipping Update',
        `Your order #${order.order_number} is now at: ${location}. ${description}`,
        'order',
        { order_id: id, order_number: order.order_number }
      );
    }
    res.json({
      success: true,
      message: 'Tracking updated successfully.',
      tracking: {
        location,
        description,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Update tracking location error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tracking.'
    });
  }
};
module.exports = {
  createOrder,
  createOrderDirect,
  getCustomerOrders,
  getOrder,
  getShopOrders,
  updateOrderStatus,
  cancelOrder,
  downloadInvoice,
  getAllOrders,
  getDetailedTracking,
  updateTrackingLocation
};
