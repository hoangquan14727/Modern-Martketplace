const { pool } = require('../config/database');
const getCart = async (req, res) => {
  try {
    let [customers] = await pool.query(
      'SELECT id FROM customers WHERE user_id = ?',
      [req.user.id]
    );
    if (customers.length === 0) {
      const [newCustomer] = await pool.query(
        'INSERT INTO customers (user_id, first_name, last_name) VALUES (?, ?, ?)',
        [req.user.id, 'User', req.user.role]
      );
      customers = [{ id: newCustomer.insertId }];
    }
    const customerId = customers[0].id;
    let [carts] = await pool.query(
      'SELECT id FROM carts WHERE customer_id = ?',
      [customerId]
    );
    if (carts.length === 0) {
      const [result] = await pool.query(
        'INSERT INTO carts (customer_id) VALUES (?)',
        [customerId]
      );
      carts = [{ id: result.insertId }];
    }
    const cartId = carts[0].id;
    const [items] = await pool.query(
      `SELECT
        ci.id,
        ci.quantity,
        ci.product_id,
        ci.variant_id,
        ci.price_at_add,
        p.name as product_name,
        p.price,
        p.original_price,
        p.stock_quantity,
        p.is_active,
        p.status as product_status,
        pv.name as variant_name,
        pv.price as variant_price,
        pv.stock_quantity as variant_stock,
        s.id as shop_id,
        s.shop_name,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN product_variants pv ON ci.variant_id = pv.id
      JOIN shops s ON p.shop_id = s.id
      WHERE ci.cart_id = ?
      ORDER BY ci.created_at DESC`,
      [cartId]
    );
    const groupedItems = items.reduce((acc, item) => {
      const shopKey = item.shop_id;
      if (!acc[shopKey]) {
        acc[shopKey] = {
          shop_id: item.shop_id,
          shop_name: item.shop_name,
          items: []
        };
      }
      const currentPrice = item.variant_price || item.price;
      const snapshotPrice = item.price_at_add != null ? item.price_at_add : currentPrice;
      const priceChanged = Number(snapshotPrice) !== Number(currentPrice);
      const actualStock = item.variant_id ? item.variant_stock : item.stock_quantity;
      const isAvailable = item.is_active && item.product_status === 'approved' && actualStock > 0;
      acc[shopKey].items.push({
        id: item.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product_name,
        variant_name: item.variant_name,
        image: item.image,
        price: currentPrice,
        price_at_add: snapshotPrice,
        price_changed: priceChanged,
        original_price: item.original_price,
        quantity: item.quantity,
        stock: actualStock,
        subtotal: currentPrice * item.quantity,
        is_available: isAvailable
      });
      return acc;
    }, {});
    let totalItems = 0;
    let totalAmount = 0;
    Object.values(groupedItems).forEach(shop => {
      shop.items.forEach(item => {
        if (item.is_available) {
          totalItems += item.quantity;
          totalAmount += item.subtotal;
        }
      });
    });
    res.json({
      success: true,
      data: {
        cart_id: cartId,
        shops: Object.values(groupedItems),
        summary: {
          total_items: totalItems,
          total_amount: totalAmount
        }
      }
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cart.'
    });
  }
};
const addToCart = async (req, res) => {
  try {
    const { productId, variantId, quantity = 1 } = req.body;
    let [customers] = await pool.query(
      'SELECT id FROM customers WHERE user_id = ?',
      [req.user.id]
    );
    if (customers.length === 0) {
      const [newCustomer] = await pool.query(
        'INSERT INTO customers (user_id, first_name, last_name) VALUES (?, ?, ?)',
        [req.user.id, 'User', req.user.role]
      );
      customers = [{ id: newCustomer.insertId }];
    }
    const customerId = customers[0].id;
    const [products] = await pool.query(
      `SELECT p.id, p.price, p.stock_quantity, p.is_active, p.status
       FROM products p WHERE p.id = ?`,
      [productId]
    );
    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }
    const product = products[0];
    if (!product.is_active || product.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Product is not available.'
      });
    }
    let availableStock = product.stock_quantity;
    if (variantId) {
      const [variants] = await pool.query(
        'SELECT stock_quantity FROM product_variants WHERE id = ? AND product_id = ?',
        [variantId, productId]
      );
      if (variants.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Variant not found.'
        });
      }
      availableStock = variants[0].stock_quantity;
    }
    let [carts] = await pool.query(
      'SELECT id FROM carts WHERE customer_id = ?',
      [customerId]
    );
    if (carts.length === 0) {
      const [result] = await pool.query(
        'INSERT INTO carts (customer_id) VALUES (?)',
        [customerId]
      );
      carts = [{ id: result.insertId }];
    }
    const cartId = carts[0].id;
    const [existingItems] = await pool.query(
      `SELECT id, quantity FROM cart_items
       WHERE cart_id = ? AND product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))`,
      [cartId, productId, variantId, variantId]
    );
    let currentPrice = product.price != null ? product.price : 0;
    if (variantId) {
      const [variantPriceRows] = await pool.query(
        'SELECT price FROM product_variants WHERE id = ?',
        [variantId]
      );
      if (variantPriceRows.length > 0 && variantPriceRows[0].price != null) {
        currentPrice = variantPriceRows[0].price;
      }
    }
    let newQuantity = quantity;
    if (existingItems.length > 0) {
      newQuantity = existingItems[0].quantity + quantity;
      if (newQuantity > availableStock) {
        return res.status(400).json({
          success: false,
          message: `Only ${availableStock} items available in stock.`
        });
      }
      await pool.query(
        'UPDATE cart_items SET quantity = ?, price_at_add = ? WHERE id = ?',
        [newQuantity, currentPrice, existingItems[0].id]
      );
    } else {
      if (quantity > availableStock) {
        return res.status(400).json({
          success: false,
          message: `Only ${availableStock} items available in stock.`
        });
      }
      await pool.query(
        'INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, price_at_add) VALUES (?, ?, ?, ?, ?)',
        [cartId, productId, variantId || null, quantity, currentPrice]
      );
    }
    res.json({
      success: true,
      message: 'Item added to cart.'
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to cart.'
    });
  }
};
const updateCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    let [customers] = await pool.query(
      'SELECT id FROM customers WHERE user_id = ?',
      [req.user.id]
    );
    if (customers.length === 0) {
      const [newCustomer] = await pool.query(
        'INSERT INTO customers (user_id, first_name, last_name) VALUES (?, ?, ?)',
        [req.user.id, 'User', req.user.role]
      );
      customers = [{ id: newCustomer.insertId }];
    }
    const customerId = customers[0].id;
    const [carts] = await pool.query(
      'SELECT id FROM carts WHERE customer_id = ?',
      [customerId]
    );
    if (carts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found.'
      });
    }
    const [items] = await pool.query(
      `SELECT ci.*, p.stock_quantity, pv.stock_quantity as variant_stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       LEFT JOIN product_variants pv ON ci.variant_id = pv.id
       WHERE ci.id = ? AND ci.cart_id = ?`,
      [id, carts[0].id]
    );
    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found.'
      });
    }
    const availableStock = items[0].variant_id ? items[0].variant_stock : items[0].stock_quantity;
    if (quantity > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableStock} items available in stock.`
      });
    }
    if (quantity <= 0) {
      await pool.query('DELETE FROM cart_items WHERE id = ?', [id]);
      return res.json({
        success: true,
        message: 'Item removed from cart.'
      });
    }
    await pool.query(
      'UPDATE cart_items SET quantity = ? WHERE id = ?',
      [quantity, id]
    );
    res.json({
      success: true,
      message: 'Cart updated.'
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cart.'
    });
  }
};
const removeCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    let [customers] = await pool.query(
      'SELECT id FROM customers WHERE user_id = ?',
      [req.user.id]
    );
    if (customers.length === 0) {
      const [newCustomer] = await pool.query(
        'INSERT INTO customers (user_id, first_name, last_name) VALUES (?, ?, ?)',
        [req.user.id, 'User', req.user.role]
      );
      customers = [{ id: newCustomer.insertId }];
    }
    const customerId = customers[0].id;
    const [carts] = await pool.query(
      'SELECT id FROM carts WHERE customer_id = ?',
      [customerId]
    );
    if (carts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found.'
      });
    }
    const [result] = await pool.query(
      'DELETE FROM cart_items WHERE id = ? AND cart_id = ?',
      [id, carts[0].id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found.'
      });
    }
    res.json({
      success: true,
      message: 'Item removed from cart.'
    });
  } catch (error) {
    console.error('Remove cart item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item.'
    });
  }
};
const clearCart = async (req, res) => {
  try {
    let [customers] = await pool.query(
      'SELECT id FROM customers WHERE user_id = ?',
      [req.user.id]
    );
    if (customers.length === 0) {
      const [newCustomer] = await pool.query(
        'INSERT INTO customers (user_id, first_name, last_name) VALUES (?, ?, ?)',
        [req.user.id, 'User', req.user.role]
      );
      customers = [{ id: newCustomer.insertId }];
    }
    const customerId = customers[0].id;
    const [carts] = await pool.query(
      'SELECT id FROM carts WHERE customer_id = ?',
      [customerId]
    );
    if (carts.length > 0) {
      await pool.query('DELETE FROM cart_items WHERE cart_id = ?', [carts[0].id]);
    }
    res.json({
      success: true,
      message: 'Cart cleared.'
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart.'
    });
  }
};
module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart
};
