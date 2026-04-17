const { v4: uuidv4 } = require('uuid');
const generateOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${year}${month}${day}${random}`;
};
const generateTicketNumber = () => {
  const random = uuidv4().split('-')[0].toUpperCase();
  return `TKT${random}`;
};
const generateTransactionNumber = () => {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `TXN${timestamp}${random}`;
};
const createSlug = (str) => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};
const paginate = (page = 1, limit = 10) => {
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(1000, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;
  return {
    page: pageNum,
    limit: limitNum,
    offset
  };
};
const paginateResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};
const calculateDiscount = (originalPrice, discountType, discountValue, maxDiscount = null) => {
  let discount = 0;
  if (discountType === 'percentage') {
    discount = (originalPrice * discountValue) / 100;
  } else if (discountType === 'fixed_amount') {
    discount = discountValue;
  }
  if (maxDiscount && discount > maxDiscount) {
    discount = maxDiscount;
  }
  return Math.min(discount, originalPrice);
};
const formatCurrency = (amount, currency = 'VND') => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency
  }).format(amount);
};
const successResponse = (res, data, code = 200) => {
  return res.status(code).json({
    success: true,
    data
  });
};
const errorResponse = (res, message, code = 500) => {
  return res.status(code).json({
    success: false,
    message
  });
};
module.exports = {
  generateOrderNumber,
  generateTicketNumber,
  generateTransactionNumber,
  createSlug,
  paginate,
  paginateResponse,
  calculateDiscount,
  formatCurrency,
  successResponse,
  errorResponse
};
