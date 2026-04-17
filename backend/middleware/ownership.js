const db = require('../config/database');

const resolveShopId = (req) => {
  if (req.user.role === 'admin') {
    const raw = req.query.shopId || req.params.shopId || req.body.shopId;
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
  }
  if (req.user.role === 'shop') {
    const shop = db.prepare('SELECT id FROM shops WHERE user_id = ?').get(req.user.id);
    return shop ? shop.id : null;
  }
  return null;
};

const resolveCustomerId = (req) => {
  if (req.user.role === 'admin') {
    const raw = req.query.customerId || req.params.customerId || req.body.customerId;
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
  }
  if (req.user.role === 'customer') {
    const c = db.prepare('SELECT id FROM customers WHERE user_id = ?').get(req.user.id);
    return c ? c.id : null;
  }
  return null;
};

const attachShop = (req, res, next) => {
  const shopId = resolveShopId(req);
  if (!shopId) {
    return res.status(403).json({ success: false, message: 'Shop context required.' });
  }
  req.shopId = shopId;
  next();
};

const attachCustomer = (req, res, next) => {
  const customerId = resolveCustomerId(req);
  if (!customerId) {
    return res.status(403).json({ success: false, message: 'Customer context required.' });
  }
  req.customerId = customerId;
  next();
};

const ownsOrder = (req, res, next) => {
  const idRaw = req.params.id;
  const n = Number(idRaw);
  if (!Number.isInteger(n) || n <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid order id.' });
  }
  const order = db.prepare('SELECT customer_id, shop_id FROM orders WHERE id = ? OR order_number = ?').get(n, idRaw);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }
  if (req.user.role === 'admin') { req.order = order; return next(); }
  if (req.user.role === 'customer') {
    const c = db.prepare('SELECT id FROM customers WHERE user_id = ?').get(req.user.id);
    if (!c || Number(c.id) !== Number(order.customer_id)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }
    req.order = order;
    return next();
  }
  if (req.user.role === 'shop') {
    const s = db.prepare('SELECT id FROM shops WHERE user_id = ?').get(req.user.id);
    if (!s || Number(s.id) !== Number(order.shop_id)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }
    req.order = order;
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden.' });
};

const ownsProduct = (req, res, next) => {
  if (req.user.role === 'admin') return next();
  const idRaw = req.params.id;
  const n = Number(idRaw);
  if (!Number.isInteger(n) || n <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid product id.' });
  }
  const product = db.prepare('SELECT shop_id FROM products WHERE id = ?').get(n);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }
  if (req.user.role === 'shop') {
    const s = db.prepare('SELECT id FROM shops WHERE user_id = ?').get(req.user.id);
    if (!s || Number(s.id) !== Number(product.shop_id)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden.' });
};

module.exports = {
  resolveShopId,
  resolveCustomerId,
  attachShop,
  attachCustomer,
  ownsOrder,
  ownsProduct
};
