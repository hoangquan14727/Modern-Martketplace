const { pool } = require('../config/database');
const { paginate, paginateResponse, createSlug } = require('../utils/helpers');
const { sanitizePlainText } = require('../utils/sanitize');
const getProducts = async (req, res) => {
  try {
    const {
      page,
      limit,
      category,
      shop_id,
      min_price,
      max_price,
      search,
      sort,
      is_featured
    } = req.query;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = "WHERE p.is_active = 1 AND p.status = ?";
    const params = ['approved'];
    if (category) {
      whereClause += ' AND (c.slug = ? OR c.id = ?)';
      params.push(category, category);
    }
    if (shop_id) {
      whereClause += ' AND p.shop_id = ?';
      params.push(shop_id);
    }
    if (min_price) {
      whereClause += ' AND p.price >= ?';
      params.push(parseFloat(min_price));
    }
    if (max_price) {
      whereClause += ' AND p.price <= ?';
      params.push(parseFloat(max_price));
    }
    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }
    if (is_featured === 'true') {
      whereClause += ' AND p.is_featured = 1';
    }
    let orderClause = 'ORDER BY p.created_at DESC';
    if (sort === 'price_asc') {
      orderClause = 'ORDER BY p.price ASC';
    } else if (sort === 'price_desc') {
      orderClause = 'ORDER BY p.price DESC';
    } else if (sort === 'rating') {
      orderClause = 'ORDER BY p.rating DESC';
    } else if (sort === 'sold') {
      orderClause = 'ORDER BY p.sold_quantity DESC';
    } else if (sort === 'newest') {
      orderClause = 'ORDER BY p.created_at DESC';
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [products] = await pool.query(
      `SELECT
        p.id,
        p.name,
        p.slug,
        p.short_description,
        p.price,
        p.original_price,
        p.stock_quantity,
        p.sold_quantity,
        p.rating,
        p.total_reviews,
        p.is_featured,
        p.status,
        p.is_active,
        p.created_at,
        c.id as category_id,
        c.name as category_name,
        c.slug as category_slug,
        s.id as shop_id,
        s.shop_name,
        s.slug as shop_slug,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN shops s ON p.shop_id = s.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(products, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get products.'
    });
  }
};
const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const [products] = await pool.query(
      `SELECT
        p.*,
        c.id as category_id,
        c.name as category_name,
        c.slug as category_slug,
        s.id as shop_id,
        s.shop_name,
        s.slug as shop_slug,
        s.logo as shop_logo,
        s.rating as shop_rating,
        s.total_reviews as shop_total_reviews
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN shops s ON p.shop_id = s.id
      WHERE p.id = ? OR p.slug = ?`,
      [id, id]
    );
    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }
    const product = products[0];
    const [images] = await pool.query(
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC',
      [product.id]
    );
    const [variants] = await pool.query(
      'SELECT * FROM product_variants WHERE product_id = ?',
      [product.id]
    );
    const [reviewSummary] = await pool.query(
      `SELECT
        COUNT(*) as total,
        AVG(rating) as average,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
      FROM reviews WHERE product_id = ? AND status = 'approved'`,
      [product.id]
    );
    res.json({
      success: true,
      data: {
        ...product,
        images,
        variants,
        reviewSummary: reviewSummary[0]
      }
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get product.'
    });
  }
};
const createProduct = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    let {
      name,
      description,
      shortDescription,
      price,
      originalPrice,
      categoryId,
      sku,
      stockQuantity,
      weight,
      dimensions,
      tags,
      isFeatured,
      images,
      variants
    } = req.body;
    name = sanitizePlainText(name, 255);
    description = sanitizePlainText(description, 10000);
    shortDescription = sanitizePlainText(shortDescription, 500);
    if (price != null && Number(price) < 0) {
      return res.status(400).json({ success: false, message: 'Price must be non-negative.' });
    }
    if (stockQuantity != null && Number(stockQuantity) < 0) {
      return res.status(400).json({ success: false, message: 'Stock must be non-negative.' });
    }
    const [shops] = await connection.query(
      'SELECT id, status FROM shops WHERE user_id = ?',
      [req.user.id]
    );
    if (shops.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Shop not found.'
      });
    }
    if (shops[0].status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Shop is not approved yet.'
      });
    }
    const shopId = shops[0].id;
    await connection.beginTransaction();
    const slug = createSlug(name) + '-' + Date.now();
    const [result] = await connection.query(
      `INSERT INTO products
       (shop_id, category_id, name, slug, description, short_description, price, original_price,
        sku, stock_quantity, weight, dimensions, tags, is_featured, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shopId,
        categoryId || null,
        name,
        slug,
        description || null,
        shortDescription || null,
        price,
        originalPrice || null,
        sku || null,
        stockQuantity || 0,
        weight || null,
        dimensions || null,
        tags ? JSON.stringify(tags) : null,
        isFeatured ? 1 : 0,
        'pending'
      ]
    );
    const productId = result.insertId;
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        await connection.query(
          'INSERT INTO product_images (product_id, image_url, is_primary, sort_order) VALUES (?, ?, ?, ?)',
          [productId, images[i], i === 0 ? 1 : 0, i]
        );
      }
    }
    if (variants && variants.length > 0) {
      for (const variant of variants) {
        await connection.query(
          `INSERT INTO product_variants
           (product_id, name, sku, price, stock_quantity, attributes, image)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            productId,
            variant.name,
            variant.sku || null,
            variant.price || null,
            variant.stockQuantity || 0,
            variant.attributes ? JSON.stringify(variant.attributes) : null,
            variant.image || null
          ]
        );
      }
    }
    await connection.query(
      'UPDATE shops SET total_products = total_products + 1 WHERE id = ?',
      [shopId]
    );
    await connection.commit();
    res.status(201).json({
      success: true,
      message: 'Product created successfully. Waiting for approval.',
      data: { id: productId, slug }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product.'
    });
  } finally {
    connection.release();
  }
};
const updateProduct = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const {
      name,
      description,
      shortDescription,
      price,
      originalPrice,
      categoryId,
      sku,
      stockQuantity,
      weight,
      dimensions,
      tags,
      isFeatured,
      isActive,
      images,
      variants
    } = req.body;
    const [shops] = await connection.query(
      'SELECT id FROM shops WHERE user_id = ?',
      [req.user.id]
    );
    if (shops.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Shop not found.'
      });
    }
    const shopId = shops[0].id;
    const [products] = await connection.query(
      'SELECT id FROM products WHERE id = ? AND shop_id = ?',
      [id, shopId]
    );
    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }
    await connection.beginTransaction();
    const updates = [];
    const params = [];
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(sanitizePlainText(name, 255));
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(sanitizePlainText(description, 10000));
    }
    if (shortDescription !== undefined) {
      updates.push('short_description = ?');
      params.push(sanitizePlainText(shortDescription, 500));
    }
    if (price !== undefined) {
      if (Number(price) < 0) {
        return res.status(400).json({ success: false, message: 'Price must be non-negative.' });
      }
      updates.push('price = ?');
      params.push(price);
    }
    if (originalPrice !== undefined) {
      updates.push('original_price = ?');
      params.push(originalPrice);
    }
    if (categoryId !== undefined) {
      updates.push('category_id = ?');
      params.push(categoryId);
    }
    if (sku !== undefined) {
      updates.push('sku = ?');
      params.push(sku);
    }
    if (stockQuantity !== undefined) {
      if (Number(stockQuantity) < 0) {
        return res.status(400).json({ success: false, message: 'Stock must be non-negative.' });
      }
      updates.push('stock_quantity = ?');
      params.push(stockQuantity);
    }
    if (weight !== undefined) {
      updates.push('weight = ?');
      params.push(weight);
    }
    if (dimensions !== undefined) {
      updates.push('dimensions = ?');
      params.push(dimensions);
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(tags));
    }
    if (isFeatured !== undefined) {
      updates.push('is_featured = ?');
      params.push(isFeatured ? 1 : 0);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    if (updates.length > 0) {
      params.push(id);
      await connection.query(
        `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }
    if (images !== undefined) {
      await connection.query('DELETE FROM product_images WHERE product_id = ?', [id]);
      for (let i = 0; i < images.length; i++) {
        await connection.query(
          'INSERT INTO product_images (product_id, image_url, is_primary, sort_order) VALUES (?, ?, ?, ?)',
          [id, images[i], i === 0 ? 1 : 0, i]
        );
      }
    }
    if (variants !== undefined) {
      await connection.query('DELETE FROM product_variants WHERE product_id = ?', [id]);
      for (const variant of variants) {
        await connection.query(
          `INSERT INTO product_variants
           (product_id, name, sku, price, stock_quantity, attributes, image)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            variant.name,
            variant.sku || null,
            variant.price || null,
            variant.stockQuantity || 0,
            variant.attributes ? JSON.stringify(variant.attributes) : null,
            variant.image || null
          ]
        );
      }
    }
    await connection.commit();
    res.json({
      success: true,
      message: 'Product updated successfully.'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product.'
    });
  } finally {
    connection.release();
  }
};
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const [shops] = await pool.query(
      'SELECT id FROM shops WHERE user_id = ?',
      [req.user.id]
    );
    if (shops.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Shop not found.'
      });
    }
    const shopId = shops[0].id;
    const [result] = await pool.query(
      'DELETE FROM products WHERE id = ? AND shop_id = ?',
      [id, shopId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }
    await pool.query(
      'UPDATE shops SET total_products = total_products - 1 WHERE id = ? AND total_products > 0',
      [shopId]
    );
    res.json({
      success: true,
      message: 'Product deleted successfully.'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product.'
    });
  }
};
const getShopProducts = async (req, res) => {
  try {
    const { page, limit, status, search } = req.query;
    const [shops] = await pool.query(
      'SELECT id FROM shops WHERE user_id = ?',
      [req.user.id]
    );
    if (shops.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Shop not found.'
      });
    }
    const shopId = shops[0].id;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = 'WHERE p.shop_id = ?';
    const params = [shopId];
    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }
    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM products p ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [products] = await pool.query(
      `SELECT
        p.*,
        c.name as category_name,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(products, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get shop products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get products.'
    });
  }
};
const getAllProductsAdmin = async (req, res) => {
  try {
    const { page, limit, status, search } = req.query;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (status && status !== 'all') {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }
    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM products p ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [products] = await pool.query(
      `SELECT
        p.*,
        c.name as category_name,
        s.shop_name,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image_url
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN shops s ON p.shop_id = s.id
      ${whereClause}
      ORDER BY
        CASE p.status
          WHEN 'pending' THEN 1
          WHEN 'approved' THEN 2
          WHEN 'rejected' THEN 3
        END,
        p.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({
      success: true,
      ...paginateResponse(products, total, pageNum, limitNum)
    });
  } catch (error) {
    console.error('Get all products admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get products.'
    });
  }
};
const updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be approved or rejected.'
      });
    }
    const [result] = await pool.query(
      'UPDATE products SET status = ? WHERE id = ?',
      [status, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }
    res.json({
      success: true,
      message: `Product ${status} successfully.`
    });
  } catch (error) {
    console.error('Update product status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product status.'
    });
  }
};
module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getShopProducts,
  getAllProductsAdmin,
  updateProductStatus
};
