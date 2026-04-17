const db = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const { resolveShopId } = require('../middleware/ownership');

exports.getInventoryLogs = (req, res) => {
  try {
    const { product_id, type, limit = 50, offset = 0 } = req.query;
    const shopId = resolveShopId(req);
    if (!shopId) return errorResponse(res, 'Shop context required', 403);

    let query = `
      SELECT
        inventory_logs.*,
        products.name as product_name,
        products.sku,
        product_variants.name as variant_name,
        users.email as created_by_email
      FROM inventory_logs
      JOIN products ON inventory_logs.product_id = products.id
      LEFT JOIN product_variants ON inventory_logs.variant_id = product_variants.id
      LEFT JOIN users ON inventory_logs.created_by = users.id
      WHERE products.shop_id = ?
    `;
    const params = [shopId];
    if (product_id) { query += ' AND inventory_logs.product_id = ?'; params.push(Number(product_id)); }
    if (type) { query += ' AND inventory_logs.type = ?'; params.push(type); }
    query += ' ORDER BY inventory_logs.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const logs = db.prepare(query).all(...params);

    let countQuery = `
      SELECT COUNT(*) as total
      FROM inventory_logs
      JOIN products ON inventory_logs.product_id = products.id
      WHERE products.shop_id = ?
    `;
    const countParams = [shopId];
    if (product_id) { countQuery += ' AND inventory_logs.product_id = ?'; countParams.push(Number(product_id)); }
    if (type) { countQuery += ' AND inventory_logs.type = ?'; countParams.push(type); }
    const { total } = db.prepare(countQuery).get(...countParams);

    return successResponse(res, {
      logs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + logs.length < total
      }
    });
  } catch (error) {
    console.error('Get inventory logs error:', error);
    return errorResponse(res, 'Failed to fetch inventory logs', 500);
  }
};

exports.addInventoryAdjustment = (req, res) => {
  try {
    const { product_id, variant_id, quantity, note, type = 'adjustment' } = req.body;
    if (!product_id || quantity === undefined) {
      return errorResponse(res, 'Product ID and quantity are required', 400);
    }
    const product = db.prepare('SELECT shop_id, stock_quantity, name FROM products WHERE id = ?').get(Number(product_id));
    if (!product) return errorResponse(res, 'Product not found', 404);

    if (req.user.role === 'shop') {
      const shop = db.prepare('SELECT id FROM shops WHERE user_id = ?').get(req.user.id);
      if (!shop || Number(shop.id) !== Number(product.shop_id)) {
        return errorResponse(res, 'Unauthorized access to this product', 403);
      }
    }

    const quantityChange = parseInt(quantity);
    const newStock = product.stock_quantity + quantityChange;
    if (newStock < 0) return errorResponse(res, 'Stock cannot be negative', 400);

    const insertLog = db.prepare(`
      INSERT INTO inventory_logs (product_id, variant_id, type, quantity, reference_type, note, created_by)
      VALUES (?, ?, ?, ?, 'manual', ?, ?)
    `);
    const updateProduct = db.prepare(`
      UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    const runTx = db.transaction(() => {
      insertLog.run(Number(product_id), variant_id ? Number(variant_id) : null, type, quantityChange, note || 'Manual adjustment', req.user.id);
      updateProduct.run(newStock, Number(product_id));
      if (variant_id) {
        const variant = db.prepare('SELECT stock_quantity FROM product_variants WHERE id = ?').get(Number(variant_id));
        if (variant) {
          const newVariantStock = variant.stock_quantity + quantityChange;
          db.prepare('UPDATE product_variants SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newVariantStock, Number(variant_id));
        }
      }
    });
    runTx();

    return successResponse(res, {
      message: 'Inventory adjusted successfully',
      product_name: product.name,
      previous_stock: product.stock_quantity,
      adjustment: quantityChange,
      new_stock: newStock
    });
  } catch (error) {
    console.error('Add inventory adjustment error:', error);
    return errorResponse(res, 'Failed to adjust inventory', 500);
  }
};

exports.getStockAlerts = (req, res) => {
  try {
    const { threshold = 10 } = req.query;
    const shopId = resolveShopId(req);
    if (!shopId) return errorResponse(res, 'Shop context required', 403);

    const lowStockProducts = db.prepare(`
      SELECT id, name, sku, stock_quantity, sold_quantity, is_active, updated_at
      FROM products
      WHERE shop_id = ? AND stock_quantity <= ? AND is_active = 1
      ORDER BY stock_quantity ASC
    `).all(shopId, parseInt(threshold));

    const lowStockVariants = db.prepare(`
      SELECT pv.id as variant_id, pv.name as variant_name, pv.sku as variant_sku,
             pv.stock_quantity, p.id as product_id, p.name as product_name
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE p.shop_id = ? AND pv.stock_quantity <= ?
      ORDER BY pv.stock_quantity ASC
    `).all(shopId, parseInt(threshold));

    return successResponse(res, {
      low_stock_products: lowStockProducts,
      low_stock_variants: lowStockVariants,
      total_alerts: lowStockProducts.length + lowStockVariants.length
    });
  } catch (error) {
    console.error('Get stock alerts error:', error);
    return errorResponse(res, 'Failed to fetch stock alerts', 500);
  }
};

exports.exportInventoryReport = (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const shopId = resolveShopId(req);
    if (!shopId) return errorResponse(res, 'Shop context required', 403);

    const currentInventory = db.prepare(`
      SELECT products.id, products.name, products.sku, products.stock_quantity,
             products.sold_quantity, products.price, categories.name as category_name,
             products.updated_at
      FROM products
      LEFT JOIN categories ON products.category_id = categories.id
      WHERE products.shop_id = ? AND products.is_active = 1
      ORDER BY products.name
    `).all(shopId);

    let movementsQuery = `
      SELECT inventory_logs.*, products.name as product_name, products.sku
      FROM inventory_logs
      JOIN products ON inventory_logs.product_id = products.id
      WHERE products.shop_id = ?
    `;
    const params = [shopId];
    if (start_date) { movementsQuery += ' AND inventory_logs.created_at >= ?'; params.push(start_date); }
    if (end_date) { movementsQuery += ' AND inventory_logs.created_at <= ?'; params.push(end_date); }
    movementsQuery += ' ORDER BY inventory_logs.created_at DESC';
    const movements = db.prepare(movementsQuery).all(...params);

    const totalValue = currentInventory.reduce((sum, item) => sum + (item.stock_quantity * item.price), 0);
    const totalItems = currentInventory.reduce((sum, item) => sum + item.stock_quantity, 0);
    const lowStockCount = currentInventory.filter(item => item.stock_quantity <= 10).length;

    return successResponse(res, {
      report: {
        generated_at: new Date().toISOString(),
        shop_id: shopId,
        date_range: { start: start_date || 'all time', end: end_date || 'now' },
        summary: {
          total_products: currentInventory.length,
          total_items_in_stock: totalItems,
          total_inventory_value: totalValue.toFixed(2),
          low_stock_alerts: lowStockCount
        },
        current_inventory: currentInventory,
        movements
      }
    });
  } catch (error) {
    console.error('Export inventory report error:', error);
    return errorResponse(res, 'Failed to generate inventory report', 500);
  }
};

exports.getInventorySummary = (req, res) => {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) return errorResponse(res, 'Shop context required', 403);

    const stats = db.prepare(`
      SELECT COUNT(*) as total_products, SUM(stock_quantity) as total_stock,
             SUM(sold_quantity) as total_sold,
             SUM(CASE WHEN stock_quantity <= 10 THEN 1 ELSE 0 END) as low_stock_count,
             SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_count,
             SUM(stock_quantity * price) as total_inventory_value
      FROM products
      WHERE shop_id = ? AND is_active = 1
    `).get(shopId);

    const recentMovements = db.prepare(`
      SELECT COUNT(*) as count, type, SUM(quantity) as total_quantity
      FROM inventory_logs
      JOIN products ON inventory_logs.product_id = products.id
      WHERE products.shop_id = ? AND inventory_logs.created_at >= datetime('now', '-7 days')
      GROUP BY type
    `).all(shopId);

    return successResponse(res, {
      summary: {
        ...stats,
        total_inventory_value: parseFloat(stats.total_inventory_value || 0).toFixed(2)
      },
      recent_movements: recentMovements
    });
  } catch (error) {
    console.error('Get inventory summary error:', error);
    return errorResponse(res, 'Failed to fetch inventory summary', 500);
  }
};
