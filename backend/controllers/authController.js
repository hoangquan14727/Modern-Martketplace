const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');
const EmailService = require('../services/emailService');
const generateToken = (userId, role) => {
  if (!process.env.JWT_SECRET) {
    if (!global.__jwtSecret) global.__jwtSecret = require('crypto').randomBytes(32).toString('hex');
    console.warn('WARNING: Using auto-generated JWT secret. Please set JWT_SECRET environment variable in production.');
  }
  const secret = process.env.JWT_SECRET || global.__jwtSecret;
  return jwt.sign(
    { userId, role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};
const register = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered.'
      });
    }
    await connection.beginTransaction();
    const hashedPassword = await bcrypt.hash(password, 12);
    const [userResult] = await connection.query(
      'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
      [email, hashedPassword, 'customer']
    );
    const userId = userResult.insertId;
    await connection.query(
      'INSERT INTO customers (user_id, first_name, last_name, phone) VALUES (?, ?, ?, ?)',
      [userId, firstName, lastName, phone || null]
    );
    const [customerResult] = await connection.query(
      'SELECT id FROM customers WHERE user_id = ?',
      [userId]
    );
    await connection.query(
      'INSERT INTO carts (customer_id) VALUES (?)',
      [customerResult[0].id]
    );
    await connection.commit();
    const token = generateToken(userId, 'customer');
    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        token,
        user: {
          id: userId,
          email,
          role: 'customer',
          firstName,
          lastName
        }
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed.'
    });
  } finally {
    connection.release();
  }
};
const registerShop = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { email, password, shopName, phone, description } = req.body;
    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered.'
      });
    }
    await connection.beginTransaction();
    const hashedPassword = await bcrypt.hash(password, 12);
    const [userResult] = await connection.query(
      'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
      [email, hashedPassword, 'shop']
    );
    const userId = userResult.insertId;
    const slug = shopName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim() + '-' + Date.now();
    await connection.query(
      'INSERT INTO shops (user_id, shop_name, slug, phone, description, status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, shopName, slug, phone || null, description || null, 'pending']
    );
    await connection.commit();
    const token = generateToken(userId, 'shop');
    res.status(201).json({
      success: true,
      message: 'Shop registration successful. Waiting for approval.',
      data: {
        token,
        user: {
          id: userId,
          email,
          role: 'shop',
          shopName,
          status: 'pending'
        }
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Register shop error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed.'
    });
  } finally {
    connection.release();
  }
};
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }
    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active.'
      });
    }
    let profile = null;
    if (user.role === 'customer') {
      const [customers] = await pool.query(
        'SELECT * FROM customers WHERE user_id = ?',
        [user.id]
      );
      if (customers.length > 0) {
        profile = {
          customerId: customers[0].id,
          firstName: customers[0].first_name,
          lastName: customers[0].last_name,
          phone: customers[0].phone,
          avatar: customers[0].avatar,
          membershipLevel: customers[0].membership_level,
          points: customers[0].points
        };
      }
    } else if (user.role === 'shop') {
      const [shops] = await pool.query(
        'SELECT * FROM shops WHERE user_id = ?',
        [user.id]
      );
      if (shops.length > 0) {
        profile = {
          shopId: shops[0].id,
          shopName: shops[0].shop_name,
          slug: shops[0].slug,
          logo: shops[0].logo,
          rating: shops[0].rating,
          walletBalance: shops[0].wallet_balance,
          status: shops[0].status
        };
      }
    } else if (user.role === 'admin') {
      const [admins] = await pool.query(
        'SELECT * FROM admins WHERE user_id = ?',
        [user.id]
      );
      if (admins.length > 0) {
        profile = {
          adminId: admins[0].id,
          firstName: admins[0].first_name,
          lastName: admins[0].last_name,
          department: admins[0].department,
          position: admins[0].position,
          permissions: admins[0].permissions
        };
      }
    }
    const token = generateToken(user.id, user.role);
    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          ...profile
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed.'
    });
  }
};
const getMe = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, email, role, status, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }
    const user = users[0];
    let profile = null;
    if (user.role === 'customer') {
      const [customers] = await pool.query(
        'SELECT * FROM customers WHERE user_id = ?',
        [user.id]
      );
      if (customers.length > 0) {
        profile = {
          customerId: customers[0].id,
          firstName: customers[0].first_name,
          lastName: customers[0].last_name,
          phone: customers[0].phone,
          avatar: customers[0].avatar,
          dateOfBirth: customers[0].date_of_birth,
          gender: customers[0].gender,
          membershipLevel: customers[0].membership_level,
          points: customers[0].points
        };
      }
    } else if (user.role === 'shop') {
      const [shops] = await pool.query(
        'SELECT * FROM shops WHERE user_id = ?',
        [user.id]
      );
      if (shops.length > 0) {
        profile = {
          shopId: shops[0].id,
          shopName: shops[0].shop_name,
          slug: shops[0].slug,
          description: shops[0].description,
          logo: shops[0].logo,
          banner: shops[0].banner,
          phone: shops[0].phone,
          email: shops[0].email,
          rating: shops[0].rating,
          totalReviews: shops[0].total_reviews,
          totalProducts: shops[0].total_products,
          totalSold: shops[0].total_sold,
          walletBalance: shops[0].wallet_balance,
          status: shops[0].status
        };
      }
    } else if (user.role === 'admin') {
      const [admins] = await pool.query(
        'SELECT * FROM admins WHERE user_id = ?',
        [user.id]
      );
      if (admins.length > 0) {
        profile = {
          adminId: admins[0].id,
          firstName: admins[0].first_name,
          lastName: admins[0].last_name,
          phone: admins[0].phone,
          avatar: admins[0].avatar,
          department: admins[0].department,
          position: admins[0].position,
          permissions: admins[0].permissions
        };
      }
    }
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.created_at,
        ...profile
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user info.'
    });
  }
};
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const [users] = await pool.query(
      'SELECT password FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, req.user.id]
    );
    res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password.'
    });
  }
};
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const [users] = await pool.query(
      'SELECT id, email FROM users WHERE email = ?',
      [email]
    );
    if (users.length > 0) {
      const user = users[0];
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15); 
      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, resetToken, expiresAt.toISOString()]
      );
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/resetPasswordPage.html?token=${resetToken}`;
      try {
        const [customers] = await pool.query(
          'SELECT first_name FROM customers WHERE user_id = ?',
          [user.id]
        );
        const firstName = customers.length > 0 ? customers[0].first_name : user.email.split('@')[0];
        await EmailService.sendPasswordResetEmail(
          email,
          firstName,
          resetToken,
          resetLink
        );
        console.log(`Password reset email sent to ${email}`);
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }
    }
    res.json({
      success: true,
      message: 'If the email exists, a password reset link will be sent.'
    });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process request.'
    });
  }
};
const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Reset token is required.'
      });
    }
    const [tokens] = await pool.query(
      'SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = ?',
      [token]
    );
    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token.'
      });
    }
    const resetToken = tokens[0];
    if (resetToken.used) {
      return res.status(400).json({
        success: false,
        message: 'This reset token has already been used.'
      });
    }
    const now = new Date();
    const expiresAt = new Date(resetToken.expires_at);
    if (now > expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'This reset token has expired.'
      });
    }
    res.json({
      success: true,
      message: 'Reset token is valid.'
    });
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify reset token.'
    });
  }
};
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required.'
      });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters.'
      });
    }
    const [tokens] = await pool.query(
      'SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = ?',
      [token]
    );
    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token.'
      });
    }
    const resetToken = tokens[0];
    if (resetToken.used) {
      return res.status(400).json({
        success: false,
        message: 'This reset token has already been used.'
      });
    }
    const now = new Date();
    const expiresAt = new Date(resetToken.expires_at);
    if (now > expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'This reset token has expired.'
      });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, resetToken.user_id]
    );
    await pool.query(
      'UPDATE password_reset_tokens SET used = 1 WHERE id = ?',
      [resetToken.id]
    );
    res.json({
      success: true,
      message: 'Password reset successfully.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password.'
    });
  }
};
module.exports = {
  register,
  registerShop,
  login,
  getMe,
  changePassword,
  requestPasswordReset,
  verifyResetToken,
  resetPassword
};
