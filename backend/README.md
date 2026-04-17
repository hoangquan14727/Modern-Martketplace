# E-Commerce API Backend

Hệ thống API Backend cho E-Commerce Platform sử dụng Node.js, Express và MySQL.

## Yêu cầu hệ thống

- Node.js >= 16.x
- MySQL >= 8.0
- npm hoặc yarn

## Cài đặt

### 1. Cài đặt MySQL

Đảm bảo MySQL server đang chạy trên máy tính của bạn.

### 2. Tạo Database

Mở MySQL terminal và chạy:

```bash
mysql -u root -p < database/schema.sql
```

Hoặc mở MySQL Workbench và chạy nội dung file `database/schema.sql`.

### 3. Cấu hình Environment

Sao chép file `.env.example` thành `.env` và cập nhật thông tin:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=ecommerce_db

# JWT Configuration
JWT_SECRET=your_secret_key_change_in_production
JWT_EXPIRES_IN=7d
```

### 4. Cài đặt Dependencies

```bash
cd backend
npm install
```

### 5. Chạy Seed Data (Tùy chọn)

Để có dữ liệu mẫu để test:

```bash
npm run seed
```

### 6. Khởi động Server

Development mode (auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Server sẽ chạy tại: `http://localhost:5000`

## Tài khoản Test (sau khi chạy seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ecommerce.com | 123456 |
| Shop 1 | techstore@shop.com | 123456 |
| Shop 2 | fashionhub@shop.com | 123456 |
| Shop 3 | beautyworld@shop.com | 123456 |
| Customer 1 | customer1@email.com | 123456 |
| Customer 2 | customer2@email.com | 123456 |
| Customer 3 | customer3@email.com | 123456 |

## API Documentation

Truy cập `http://localhost:5000/api` để xem danh sách tất cả các endpoints.

### Authentication Endpoints

```
POST /api/auth/register        - Đăng ký khách hàng mới
POST /api/auth/register-shop   - Đăng ký cửa hàng mới
POST /api/auth/login           - Đăng nhập
GET  /api/auth/me              - Lấy thông tin user hiện tại
PUT  /api/auth/change-password - Đổi mật khẩu
POST /api/auth/forgot-password - Yêu cầu reset mật khẩu
```

### Products Endpoints

```
GET    /api/products              - Lấy danh sách sản phẩm (public)
GET    /api/products/:id          - Lấy chi tiết sản phẩm (public)
GET    /api/products/shop/my-products - Lấy sản phẩm của shop (shop only)
POST   /api/products              - Tạo sản phẩm mới (shop only)
PUT    /api/products/:id          - Cập nhật sản phẩm (shop only)
DELETE /api/products/:id          - Xóa sản phẩm (shop only)
PATCH  /api/products/:id/status   - Duyệt/Từ chối sản phẩm (admin only)
```

### Categories Endpoints

```
GET    /api/categories      - Lấy danh sách categories
GET    /api/categories/tree - Lấy category tree
GET    /api/categories/:id  - Lấy chi tiết category
POST   /api/categories      - Tạo category (admin only)
PUT    /api/categories/:id  - Cập nhật category (admin only)
DELETE /api/categories/:id  - Xóa category (admin only)
```

### Cart Endpoints (Customer only)

```
GET    /api/cart            - Lấy giỏ hàng
POST   /api/cart/items      - Thêm vào giỏ hàng
PUT    /api/cart/items/:id  - Cập nhật số lượng
DELETE /api/cart/items/:id  - Xóa khỏi giỏ hàng
DELETE /api/cart            - Xóa toàn bộ giỏ hàng
```

### Orders Endpoints

```
POST   /api/orders              - Tạo đơn hàng (customer)
GET    /api/orders/my-orders    - Lấy đơn hàng của customer
GET    /api/orders/:id          - Lấy chi tiết đơn hàng
POST   /api/orders/:id/cancel   - Hủy đơn hàng (customer)
GET    /api/orders/shop/orders  - Lấy đơn hàng của shop
PATCH  /api/orders/:id/status   - Cập nhật trạng thái (shop)
GET    /api/orders              - Lấy tất cả đơn hàng (admin)
```

### Customer Endpoints

```
GET    /api/customers/profile      - Lấy profile
PUT    /api/customers/profile      - Cập nhật profile
GET    /api/customers/addresses    - Lấy danh sách địa chỉ
POST   /api/customers/addresses    - Thêm địa chỉ
PUT    /api/customers/addresses/:id - Cập nhật địa chỉ
DELETE /api/customers/addresses/:id - Xóa địa chỉ
GET    /api/customers/wishlist     - Lấy wishlist
POST   /api/customers/wishlist     - Thêm vào wishlist
DELETE /api/customers/wishlist/:id - Xóa khỏi wishlist
GET    /api/customers              - Lấy tất cả customers (admin)
PATCH  /api/customers/:id/status   - Cập nhật trạng thái (admin)
```

### Shop Endpoints

```
GET    /api/shops              - Lấy danh sách shops (public)
GET    /api/shops/public/:id   - Lấy thông tin shop (public)
GET    /api/shops/profile      - Lấy profile shop (owner)
PUT    /api/shops/profile      - Cập nhật profile (owner)
GET    /api/shops/dashboard    - Lấy dashboard data (owner)
GET    /api/shops/finance      - Lấy finance data (owner)
GET    /api/shops/admin/all    - Lấy tất cả shops (admin)
PATCH  /api/shops/:id/status   - Cập nhật trạng thái (admin)
```

### Reviews Endpoints

```
GET    /api/reviews/product/:id  - Lấy reviews của sản phẩm
POST   /api/reviews              - Tạo review (customer)
PUT    /api/reviews/:id          - Cập nhật review (customer)
DELETE /api/reviews/:id          - Xóa review (customer)
GET    /api/reviews/shop/reviews - Lấy reviews của shop
POST   /api/reviews/:id/reply    - Phản hồi review (shop)
GET    /api/reviews              - Lấy tất cả reviews (admin)
PATCH  /api/reviews/:id/status   - Cập nhật trạng thái (admin)
```

### Promotions Endpoints

```
GET    /api/promotions/active           - Lấy khuyến mãi đang hoạt động
POST   /api/promotions/validate-coupon  - Kiểm tra mã giảm giá
GET    /api/promotions/shop/promotions  - Lấy khuyến mãi của shop
POST   /api/promotions/shop/promotions  - Tạo khuyến mãi (shop)
PUT    /api/promotions/shop/promotions/:id - Cập nhật (shop)
DELETE /api/promotions/shop/promotions/:id - Xóa (shop)
GET    /api/promotions                  - Lấy tất cả (admin)
POST   /api/promotions/system           - Tạo khuyến mãi hệ thống (admin)
```

### Notifications Endpoints

```
GET    /api/notifications           - Lấy thông báo
PATCH  /api/notifications/:id/read  - Đánh dấu đã đọc
PATCH  /api/notifications/read-all  - Đánh dấu tất cả đã đọc
DELETE /api/notifications/:id       - Xóa thông báo
POST   /api/notifications/send      - Gửi thông báo (admin)
POST   /api/notifications/send-bulk - Gửi hàng loạt (admin)
```

### Support Endpoints

```
POST   /api/support/tickets              - Tạo ticket
GET    /api/support/tickets              - Lấy tickets của user
GET    /api/support/tickets/:id          - Lấy chi tiết ticket
POST   /api/support/tickets/:id/messages - Thêm tin nhắn
POST   /api/support/tickets/:id/close    - Đóng ticket
GET    /api/support/admin/tickets        - Lấy tất cả tickets (admin)
PATCH  /api/support/admin/tickets/:id    - Cập nhật ticket (admin)
GET    /api/support/admin/stats          - Lấy thống kê (admin)
```

### Admin Endpoints

```
GET /api/admin/dashboard      - Dashboard tổng quan
GET /api/admin/reports        - Báo cáo
GET /api/admin/finance        - Tài chính
GET /api/admin/pending-counts - Số lượng chờ duyệt
```

## Cấu trúc thư mục

```
backend/
├── config/
│   └── database.js       # Cấu hình kết nối MySQL
├── controllers/
│   ├── authController.js
│   ├── productController.js
│   ├── categoryController.js
│   ├── cartController.js
│   ├── orderController.js
│   ├── customerController.js
│   ├── shopController.js
│   ├── reviewController.js
│   ├── promotionController.js
│   ├── notificationController.js
│   ├── supportController.js
│   └── adminController.js
├── database/
│   └── schema.sql        # Database schema
├── middleware/
│   ├── auth.js           # JWT authentication
│   └── validator.js      # Request validation
├── routes/
│   ├── auth.js
│   ├── products.js
│   ├── categories.js
│   ├── cart.js
│   ├── orders.js
│   ├── customers.js
│   ├── shops.js
│   ├── reviews.js
│   ├── promotions.js
│   ├── notifications.js
│   ├── support.js
│   └── admin.js
├── seeds/
│   └── seed.js           # Sample data seeder
├── utils/
│   └── helpers.js        # Utility functions
├── uploads/              # File uploads directory
├── .env                  # Environment variables
├── .env.example          # Environment example
├── package.json
├── server.js             # Main entry point
└── README.md
```

## Sử dụng với Frontend

1. Thêm file `js/api.js` vào HTML pages:

```html
<script src="js/api.js"></script>
```

2. Sử dụng các API trong JavaScript:

```javascript
// Login
const response = await AuthAPI.login('email@example.com', '123456');

// Get products
const products = await ProductsAPI.getProducts({ category: 'electronics' });

// Add to cart
await CartAPI.addToCart(productId, 1);

// Create order
await OrdersAPI.createOrder({
  shopId: 1,
  addressId: 1,
  paymentMethod: 'cod'
});
```

## Lỗi thường gặp

1. **ECONNREFUSED**: MySQL server chưa chạy
2. **ER_BAD_DB_ERROR**: Database chưa được tạo
3. **ER_ACCESS_DENIED_ERROR**: Sai username/password MySQL
4. **Token expired**: Token hết hạn, cần login lại

## License

MIT
