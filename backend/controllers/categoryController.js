const { pool } = require('../config/database');
const { createSlug } = require('../utils/helpers');
const getCategories = async (req, res) => {
  try {
    const { parent_id, is_active } = req.query;
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (parent_id !== undefined) {
      if (parent_id === 'null' || parent_id === '') {
        whereClause += ' AND parent_id IS NULL';
      } else {
        whereClause += ' AND parent_id = ?';
        params.push(parent_id);
      }
    }
    if (is_active !== undefined) {
      whereClause += ' AND is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }
    const [categories] = await pool.query(
      `SELECT
        c.*,
        (SELECT COUNT(*) FROM products WHERE category_id = c.id AND is_active = 1 AND status = 'approved') as product_count,
        (SELECT COUNT(*) FROM categories WHERE parent_id = c.id) as subcategory_count
      FROM categories c
      ${whereClause}
      ORDER BY c.sort_order ASC, c.name ASC`,
      params
    );
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get categories.'
    });
  }
};
const getCategoryTree = async (req, res) => {
  try {
    const [categories] = await pool.query(
      `SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC`
    );
    const buildTree = (items, parentId = null) => {
      return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.id)
        }));
    };
    const tree = buildTree(categories);
    res.json({
      success: true,
      data: tree
    });
  } catch (error) {
    console.error('Get category tree error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get category tree.'
    });
  }
};
const getCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const [categories] = await pool.query(
      `SELECT
        c.*,
        p.name as parent_name,
        (SELECT COUNT(*) FROM products WHERE category_id = c.id AND is_active = 1 AND status = 'approved') as product_count
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      WHERE c.id = ? OR c.slug = ?`,
      [id, id]
    );
    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.'
      });
    }
    const [subcategories] = await pool.query(
      'SELECT * FROM categories WHERE parent_id = ? ORDER BY sort_order ASC',
      [categories[0].id]
    );
    res.json({
      success: true,
      data: {
        ...categories[0],
        subcategories
      }
    });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get category.'
    });
  }
};
const createCategory = async (req, res) => {
  try {
    const { name, description, image, parentId, sortOrder } = req.body;
    let slug = createSlug(name);
    const [existing] = await pool.query(
      'SELECT id FROM categories WHERE slug = ?',
      [slug]
    );
    if (existing.length > 0) {
      slug = slug + '-' + Date.now();
    }
    const [result] = await pool.query(
      `INSERT INTO categories (name, slug, description, image, parent_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, slug, description || null, image || null, parentId || null, sortOrder || 0]
    );
    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      data: { id: result.insertId, slug }
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create category.'
    });
  }
};
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, parentId, sortOrder, isActive } = req.body;
    const [categories] = await pool.query(
      'SELECT id FROM categories WHERE id = ?',
      [id]
    );
    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.'
      });
    }
    const updates = [];
    const params = [];
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
      let slug = createSlug(name);
      const [existing] = await pool.query(
        'SELECT id FROM categories WHERE slug = ? AND id != ?',
        [slug, id]
      );
      if (existing.length > 0) {
        slug = slug + '-' + Date.now();
      }
      updates.push('slug = ?');
      params.push(slug);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (image !== undefined) {
      updates.push('image = ?');
      params.push(image);
    }
    if (parentId !== undefined) {
      updates.push('parent_id = ?');
      params.push(parentId || null);
    }
    if (sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(sortOrder);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    if (updates.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }
    res.json({
      success: true,
      message: 'Category updated successfully.'
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category.'
    });
  }
};
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const [subcategories] = await pool.query(
      'SELECT id FROM categories WHERE parent_id = ?',
      [id]
    );
    if (subcategories.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with subcategories.'
      });
    }
    const [products] = await pool.query(
      'SELECT id FROM products WHERE category_id = ?',
      [id]
    );
    if (products.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with products. Move or delete products first.'
      });
    }
    const [result] = await pool.query(
      'DELETE FROM categories WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.'
      });
    }
    res.json({
      success: true,
      message: 'Category deleted successfully.'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category.'
    });
  }
};
module.exports = {
  getCategories,
  getCategoryTree,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
};
