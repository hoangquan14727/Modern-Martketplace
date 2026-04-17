const { pool } = require('../config/database');
const { paginate, paginateResponse } = require('../utils/helpers');
const getProfile = async (req, res) => {
  try {
    const [customers] = await pool.query(
      `SELECT c.*, u.email, u.created_at as account_created
       FROM customers c
       JOIN users u ON c.user_id = u.id
       WHERE c.user_id = ?`,
      [req.user.id]
    );
    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found.'
      });
    }
    res.json({
      success: true,
      data: customers[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile.'
    });
  }
};
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, avatar, dateOfBirth, gender } = req.body;
    const updates = [];
    const params = [];
    if (firstName !== undefined) {
      updates.push('first_name = ?');
      params.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push('last_name = ?');
      params.push(lastName);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (avatar !== undefined) {
      updates.push('avatar = ?');
      params.push(avatar);
    }
    if (dateOfBirth !== undefined) {
      updates.push('date_of_birth = ?');
      params.push(dateOfBirth);
    }
    if (gender !== undefined) {
      updates.push('gender = ?');
      params.push(gender);
    }
    if (updates.length > 0) {
      params.push(req.user.id);
      await pool.query(
        `UPDATE customers SET ${updates.join(', ')} WHERE user_id = ?`,
        params
      );
    }
    res.json({
      success: true,
      message: 'Profile updated successfully.'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile.'
    });
  }
};
const getAddresses = async (req, res) => {
  try {
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
    const [addresses] = await pool.query(
      'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC',
      [customers[0].id]
    );
    res.json({
      success: true,
      data: addresses
    });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get addresses.'
    });
  }
};
const addAddress = async (req, res) => {
  try {
    const {
      addressName,
      recipientName,
      phone,
      province,
      district,
      ward,
      streetAddress,
      isDefault
    } = req.body;
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
    if (isDefault) {
      await pool.query(
        'UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?',
        [customerId]
      );
    }
    const [result] = await pool.query(
      `INSERT INTO customer_addresses
       (customer_id, address_name, recipient_name, phone, province, district, ward, street_address, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, addressName || null, recipientName, phone, province, district, ward, streetAddress, isDefault ? 1 : 0]
    );
    res.status(201).json({
      success: true,
      message: 'Address added successfully.',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add address.'
    });
  }
};
const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      addressName,
      recipientName,
      phone,
      province,
      district,
      ward,
      streetAddress,
      isDefault
    } = req.body;
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
    const [addresses] = await pool.query(
      'SELECT id FROM customer_addresses WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );
    if (addresses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Address not found.'
      });
    }
    if (isDefault) {
      await pool.query(
        'UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?',
        [customerId]
      );
    }
    const updates = [];
    const params = [];
    if (addressName !== undefined) {
      updates.push('address_name = ?');
      params.push(addressName);
    }
    if (recipientName !== undefined) {
      updates.push('recipient_name = ?');
      params.push(recipientName);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
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
    if (isDefault !== undefined) {
      updates.push('is_default = ?');
      params.push(isDefault ? 1 : 0);
    }
    if (updates.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE customer_addresses SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }
    res.json({
      success: true,
      message: 'Address updated successfully.'
    });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update address.'
    });
  }
};
const deleteAddress = async (req, res) => {
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
    const [result] = await pool.query(
      'DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?',
      [id, customers[0].id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Address not found.'
      });
    }
    res.json({
      success: true,
      message: 'Address deleted successfully.'
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete address.'
    });
  }
};
const getWishlist = async (req, res) => {
  try {
    const { page, limit } = req.query;
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
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM wishlists WHERE customer_id = ?',
      [customerId]
    );
    const total = countResult[0].total;
    const [items] = await pool.query(
      `SELECT
        w.id,
        w.created_at as added_at,
        p.id as product_id,
        p.name,
        p.slug,
        p.price,
        p.original_price,
        p.rating,
        p.total_reviews,
        p.stock_quantity,
        p.is_active,
        p.status,
        s.shop_name,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      JOIN shops s ON p.shop_id = s.id
      WHERE w.customer_id = ?
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?`,
      [customerId, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(items, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get wishlist.'
    });
  }
};
const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
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
    const [products] = await pool.query(
      'SELECT id FROM products WHERE id = ?',
      [productId]
    );
    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }
    const [existing] = await pool.query(
      'SELECT id FROM wishlists WHERE customer_id = ? AND product_id = ?',
      [customerId, productId]
    );
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Product already in wishlist.'
      });
    }
    await pool.query(
      'INSERT INTO wishlists (customer_id, product_id) VALUES (?, ?)',
      [customerId, productId]
    );
    res.status(201).json({
      success: true,
      message: 'Added to wishlist.'
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add to wishlist.'
    });
  }
};
const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
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
    const [result] = await pool.query(
      'DELETE FROM wishlists WHERE customer_id = ? AND product_id = ?',
      [customers[0].id, productId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in wishlist.'
      });
    }
    res.json({
      success: true,
      message: 'Removed from wishlist.'
    });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove from wishlist.'
    });
  }
};
const getAllCustomers = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = "WHERE u.role = 'customer'";
    const params = [];
    if (search) {
      whereClause += ' AND (c.first_name LIKE ? OR c.last_name LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    if (status) {
      whereClause += ' AND u.status = ?';
      params.push(status);
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM users u
       LEFT JOIN customers c ON u.id = c.user_id
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [customers] = await pool.query(
      `SELECT
        c.*,
        c.first_name || ' ' || c.last_name as name,
        u.email,
        u.status,
        u.created_at,
        (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) as total_orders,
        (SELECT SUM(total_amount) FROM orders WHERE customer_id = c.id AND status = 'delivered') as total_spent
      FROM users u
      LEFT JOIN customers c ON u.id = c.user_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(customers, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get all customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get customers.'
    });
  }
};
const updateCustomerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'inactive', 'banned'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status.'
      });
    }
    const [result] = await pool.query(
      "UPDATE users SET status = ? WHERE id = ? AND role = 'customer'",
      [status, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.'
      });
    }
    res.json({
      success: true,
      message: 'Customer status updated.'
    });
  } catch (error) {
    console.error('Update customer status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer status.'
    });
  }
};
module.exports = {
  getProfile,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getAllCustomers,
  updateCustomerStatus
};
