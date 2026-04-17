const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'database', 'ecommerce.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const seedData = () => {
  try {
    console.log('Starting seed process...\n');
    const hashedPassword = bcrypt.hashSync('123456', 12);

    console.log('Creating admin user...');
    const result = db.prepare(`
      INSERT INTO users (email, password, role, status) VALUES (?, ?, 'admin', 'active')
    `).run('admin@ecommerce.com', hashedPassword);
    const adminUserId = result.lastInsertRowid;
    db.prepare(`
      INSERT INTO admins (user_id, first_name, last_name, department, position, permissions)
      VALUES (?, 'John', 'Doe', 'Management', 'Super Admin', '["all"]')
    `).run(adminUserId);
    const supportAdminResult = db.prepare(`
      INSERT INTO users (email, password, role, status) VALUES (?, ?, 'admin', 'active')
    `).run('support@ecommerce.com', hashedPassword);
    const supportAdminId = supportAdminResult.lastInsertRowid;
    db.prepare(`
      INSERT INTO admins (user_id, first_name, last_name, department, position, permissions)
      VALUES (?, 'Jane', 'Smith', 'Support', 'Support Lead', '["support", "customers"]')
    `).run(supportAdminId);
    const financeAdminResult = db.prepare(`
      INSERT INTO users (email, password, role, status) VALUES (?, ?, 'admin', 'active')
    `).run('finance@ecommerce.com', hashedPassword);
    const financeAdminId = financeAdminResult.lastInsertRowid;
    db.prepare(`
      INSERT INTO admins (user_id, first_name, last_name, department, position, permissions)
      VALUES (?, 'Robert', 'Brown', 'Finance', 'Financial Analyst', '["finance", "reports"]')
    `).run(financeAdminId);

    console.log('Creating categories...');
    const categories = [
      ['Electronics', 'electronics', 'Thiết bị điện tử, điện thoại, máy tính và phụ kiện công nghệ'],
      ['Fashion', 'fashion', 'Thời trang nam nữ, giày dép, phụ kiện'],
      ['Beauty', 'beauty', 'Mỹ phẩm, chăm sóc da và làm đẹp'],
      ['Home & Living', 'home-living', 'Đồ gia dụng, nội thất, trang trí nhà cửa'],
      ['Sports', 'sports', 'Dụng cụ thể thao, trang phục thể thao, ngoài trời'],
      ['Books', 'books', 'Sách, văn phòng phẩm, dụng cụ học tập']
    ];
    const insertCategory = db.prepare(`
      INSERT INTO categories (name, slug, description, is_active) VALUES (?, ?, ?, 1)
    `);
    for (const cat of categories) {
      insertCategory.run(cat[0], cat[1], cat[2]);
    }
    const categoryRows = db.prepare('SELECT id, name FROM categories').all();
    const categoryMap = {};
    categoryRows.forEach(c => categoryMap[c.name] = c.id);

    console.log('Creating shop users...');
    const insertUser = db.prepare(`
      INSERT INTO users (email, password, role, status) VALUES (?, ?, 'shop', 'active')
    `);
    const shop1UserId = insertUser.run('techstore@shop.com', hashedPassword).lastInsertRowid;
    const shop2UserId = insertUser.run('fashionhub@shop.com', hashedPassword).lastInsertRowid;
    const shop3UserId = insertUser.run('beautyworld@shop.com', hashedPassword).lastInsertRowid;

    console.log('Creating shop profiles...');
    const insertShop = db.prepare(`
      INSERT INTO shops (user_id, shop_name, slug, description, phone, rating, total_products, status)
      VALUES (?, ?, ?, ?, ?, ?, 0, 'approved')
    `);
    const shop1Id = insertShop.run(shop1UserId, 'Tech Store', 'tech-store', 'Cửa hàng công nghệ hàng đầu — điện thoại, laptop, phụ kiện chính hãng', '0901234567', 4.8).lastInsertRowid;
    const shop2Id = insertShop.run(shop2UserId, 'Fashion Hub', 'fashion-hub', 'Thời trang cao cấp, xu hướng mới nhất cho nam nữ', '0902345678', 4.6).lastInsertRowid;
    const shop3Id = insertShop.run(shop3UserId, 'Beauty World', 'beauty-world', 'Mỹ phẩm và chăm sóc sắc đẹp cao cấp', '0903456789', 4.7).lastInsertRowid;

    console.log('Creating customer users...');
    const insertCustomerUser = db.prepare(`
      INSERT INTO users (email, password, role, status) VALUES (?, ?, 'customer', 'active')
    `);
    const customer1UserId = insertCustomerUser.run('customer1@email.com', hashedPassword).lastInsertRowid;
    const customer2UserId = insertCustomerUser.run('customer2@email.com', hashedPassword).lastInsertRowid;
    const customer3UserId = insertCustomerUser.run('customer3@email.com', hashedPassword).lastInsertRowid;

    console.log('Creating customer profiles...');
    const insertCustomer = db.prepare(`
      INSERT INTO customers (user_id, first_name, last_name, phone, membership_level, points)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const customer1Id = insertCustomer.run(customer1UserId, 'Alex', 'Morgan', '0911111111', 'gold', 1500).lastInsertRowid;
    const customer2Id = insertCustomer.run(customer2UserId, 'Sarah', 'Johnson', '0922222222', 'silver', 800).lastInsertRowid;
    const customer3Id = insertCustomer.run(customer3UserId, 'Mike', 'Wilson', '0933333333', 'bronze', 200).lastInsertRowid;

    const insertCart = db.prepare('INSERT INTO carts (customer_id) VALUES (?)');
    insertCart.run(customer1Id);
    insertCart.run(customer2Id);
    insertCart.run(customer3Id);

    console.log('Creating customer addresses...');
    const insertAddress = db.prepare(`
      INSERT INTO customer_addresses (customer_id, address_name, recipient_name, phone, province, district, ward, street_address, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAddress.run(customer1Id, 'Home', 'Alex Morgan', '0911111111', 'Ho Chi Minh City', 'District 1', 'Ben Nghe', '123 Nguyen Hue Street', 1);
    insertAddress.run(customer1Id, 'Office', 'Alex Morgan', '0911111111', 'Ho Chi Minh City', 'District 3', 'Ward 1', '456 Le Van Sy Street', 0);
    insertAddress.run(customer2Id, 'Home', 'Sarah Johnson', '0922222222', 'Ha Noi', 'Cau Giay', 'Dich Vong', '789 Xuan Thuy Street', 1);
    insertAddress.run(customer3Id, 'Home', 'Mike Wilson', '0933333333', 'Da Nang', 'Hai Chau', 'Hai Chau 1', '321 Bach Dang Street', 1);

    console.log('Creating products...');
    const insertProduct = db.prepare(`
      INSERT INTO products (shop_id, category_id, name, slug, description, short_description, price, original_price, stock_quantity, rating, is_active, status, is_featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'approved', ?)
    `);
    const createSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    // Curated product catalog — realistic VND prices, detailed Vietnamese descriptions
    const curatedProducts = {
      'Electronics': [
        {
          name: 'Sony WH-1000XM5 Tai nghe chống ồn không dây',
          img: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=800&q=80',
          short: 'Công nghệ chống ồn hàng đầu, pin 30 giờ, âm thanh Hi-Res.',
          desc: 'Sony WH-1000XM5 viết lại chuẩn mực cho trải nghiệm nghe không gián đoạn. Hai bộ xử lý điều khiển 8 micro, công nghệ Auto NC Optimizer tự động tối ưu chống ồn theo môi trường. Driver 30mm carbon fibre tái hiện âm thanh cực chi tiết. Thời lượng pin lên tới 30 giờ, sạc nhanh 3 phút cho 3 giờ sử dụng. Kết nối đa điểm (multipoint) với 2 thiết bị cùng lúc. Chống ồn chủ động thích ứng theo áp suất khí quyển khi đi máy bay. Hỗ trợ LDAC, Hi-Res Audio Wireless.',
          price: 6490000, original: 8990000, featured: 1, shop: 1
        },
        {
          name: 'Apple MacBook Air M3 13 inch 8GB/256GB',
          img: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca4?auto=format&fit=crop&w=800&q=80',
          short: 'Chip M3 mạnh mẽ, pin 18 giờ, màn Liquid Retina 13.6".',
          desc: 'MacBook Air M3 mỏng chỉ 11.3mm, nặng 1.24kg nhưng sức mạnh thì đáng kinh ngạc. Chip Apple M3 8-core CPU, 8-core GPU xử lý mượt mọi tác vụ sáng tạo và văn phòng. Màn hình Liquid Retina 13.6 inch hỗ trợ 1 tỷ màu, 500 nits. Pin 18 giờ dùng liên tục. Thiết kế không quạt — hoạt động hoàn toàn yên tĩnh. Hỗ trợ Wi-Fi 6E, Thunderbolt/USB 4, MagSafe 3. Camera FaceTime HD 1080p, 4 micro studio-quality. Bảo hành chính hãng Apple Việt Nam 12 tháng.',
          price: 27990000, original: 31990000, featured: 1, shop: 1
        },
        {
          name: 'iPhone 15 Pro Max 256GB Chính hãng VN/A',
          img: 'https://images.unsplash.com/photo-1592286927505-1def25115481?auto=format&fit=crop&w=800&q=80',
          short: 'Titan Natural, chip A17 Pro, camera tele 5x.',
          desc: 'iPhone 15 Pro Max sở hữu khung viền titanium cấp hàng không, nhẹ hơn 19g so với thế hệ trước. Chip A17 Pro tiến trình 3nm mang đến hiệu năng GPU gấp đôi. Hệ thống camera Pro mới với ống tele 5x 120mm, cảm biến chính 48MP hỗ trợ chụp ProRAW và quay ProRes. Cổng USB-C hỗ trợ USB 3 tốc độ 10Gbps. Nút Action Button tùy biến, màn hình Super Retina XDR 6.7" ProMotion 120Hz. Dynamic Island. Pin cho 29 giờ xem video.',
          price: 33990000, original: 36990000, featured: 1, shop: 1
        },
        {
          name: 'Samsung Galaxy S24 Ultra 12GB/512GB',
          img: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=800&q=80',
          short: 'AI tích hợp, bút S Pen, camera zoom quang 5x.',
          desc: 'Galaxy S24 Ultra mở ra kỷ nguyên Galaxy AI với Circle to Search, dịch thuật real-time, trợ lý ghi chú thông minh. Màn hình Dynamic AMOLED 2X 6.8" QHD+ 120Hz, kính Corning Gorilla Armor chống lóa. Chip Snapdragon 8 Gen 3 for Galaxy. Hệ camera 200MP chính, tele 50MP 5x, siêu rộng 12MP, tele 10MP 3x. S Pen tích hợp. Khung titanium chắc chắn. Pin 5000mAh sạc nhanh 45W. Kháng nước IP68.',
          price: 31490000, original: 34990000, featured: 1, shop: 1
        },
        {
          name: 'Logitech MX Master 3S Chuột không dây cao cấp',
          img: 'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=800&q=80',
          short: 'Cảm biến 8000 DPI, click siêu êm, sạc USB-C.',
          desc: 'Logitech MX Master 3S là chuột văn phòng và sáng tạo chuyên nghiệp. Cảm biến Darkfield 8000 DPI hoạt động trên mọi bề mặt kể cả kính. Nút click Quiet Click giảm 90% âm thanh. Cuộn MagSpeed điện từ — 1000 dòng/giây khi cần tốc độ, chính xác từng dòng khi cần. Kết nối Bluetooth/USB Receiver với 3 thiết bị, chuyển nhanh bằng 1 nút. Pin 70 ngày, sạc USB-C 1 phút dùng 3 giờ. Tương thích Windows, macOS, Linux, iPadOS.',
          price: 2490000, original: 2890000, featured: 0, shop: 1
        },
        {
          name: 'Dell UltraSharp U2723QE Màn hình 27" 4K USB-C',
          img: 'https://images.unsplash.com/photo-1547394765-185e1e68f34e?auto=format&fit=crop&w=800&q=80',
          short: 'IPS Black, 4K UHD, USB-C 90W, dải màu 98% DCI-P3.',
          desc: 'Màn hình 27 inch 4K UHD (3840x2160) với tấm nền IPS Black — tỉ lệ tương phản 2000:1 gấp đôi IPS thường. Phủ 98% DCI-P3, 100% sRGB, 100% Rec. 709 — lý tưởng cho thiết kế và edit video. Hub USB-C 90W sạc laptop, cổng Ethernet, DisplayPort, HDMI, 5x USB-A. Chân đế điều chỉnh cao, xoay, nghiêng, pivot. Chế độ KVM giúp dùng 1 bộ chuột phím cho 2 máy. ComfortView Plus giảm ánh sáng xanh. Bảo hành 3 năm Premium Panel Exchange.',
          price: 18990000, original: 22990000, featured: 0, shop: 1
        },
        {
          name: 'Keychron K2 Pro Bàn phím cơ không dây',
          img: 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=800&q=80',
          short: 'Hot-swap, QMK/VIA, Bluetooth 5.1, hỗ trợ Mac/Win.',
          desc: 'Keychron K2 Pro là bàn phím cơ không dây 75% layout với khung nhôm sang trọng. Hot-swap hỗ trợ cả switch 3 pin và 5 pin. Firmware QMK/VIA lập trình không giới hạn, tùy biến keymap và macro qua trình duyệt. Switch Gateron G Pro Red/Blue/Brown pre-lubed. Keycap PBT double-shot, bền bỉ không phai chữ. LED RGB south-facing tương thích keycap custom. Pin 4000mAh dùng tới 200 giờ. Kết nối Bluetooth 5.1 với 3 thiết bị hoặc USB-C.',
          price: 3290000, original: 3890000, featured: 0, shop: 1
        },
        {
          name: 'JBL Flip 6 Loa Bluetooth di động chống nước IP67',
          img: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=80',
          short: 'JBL Pro Sound, chống nước & bụi IP67, pin 12 giờ.',
          desc: 'JBL Flip 6 mang đến âm thanh JBL Pro Sound với hệ thống 2-way: driver racetrack tối ưu cho dải mid-high và tweeter riêng cho dải treble chi tiết. Dual passive radiator đập thình thịch với bass sâu. Chuẩn chống nước & bụi IP67 — ngâm nước 1m trong 30 phút. Pin 12 giờ nghe nhạc liên tục. Kết nối PartyBoost ghép đôi nhiều loa JBL. Bluetooth 5.1. Thiết kế trụ tròn bọc lưới vải bền.',
          price: 2690000, original: 3290000, featured: 0, shop: 1
        },
        {
          name: 'iPad Air 5 (M1) Wi-Fi 256GB',
          img: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=80',
          short: 'Chip M1 cực mạnh, màn Liquid Retina 10.9", hỗ trợ Pencil 2.',
          desc: 'iPad Air 5 trang bị chip Apple M1 — hiệu năng ngang MacBook. Màn hình Liquid Retina 10.9" True Tone, P3 wide color, chống lóa. Camera trước 12MP Ultra Wide hỗ trợ Center Stage tự động bám theo khuôn mặt. Tương thích Apple Pencil thế hệ 2 (mua riêng) và Magic Keyboard. Cổng USB-C. Touch ID trong nút nguồn. Wi-Fi 6. 5 phiên bản màu: Space Gray, Pink, Purple, Blue, Starlight.',
          price: 16990000, original: 19990000, featured: 0, shop: 1
        },
        {
          name: 'GoPro Hero 12 Black Camera hành động',
          img: 'https://images.unsplash.com/photo-1564466021183-a70123631835?auto=format&fit=crop&w=800&q=80',
          short: 'Quay 5.3K60, HyperSmooth 6.0, chống nước 10m.',
          desc: 'GoPro Hero 12 Black đưa camera hành động lên đỉnh cao mới: quay 5.3K@60fps, 4K@120fps slow-mo, chụp ảnh 27MP. HyperSmooth 6.0 ổn định hình ảnh như gimbal. Pin Enduro mới cho 70% thời lượng tốt hơn khi lạnh. Hỗ trợ HDR trong cả ảnh lẫn video. Chống nước tới 10m không cần housing. Tương thích micro và phụ kiện qua adapter. Kết nối Bluetooth tai nghe AirPods/GoPro. GP-Log cho dân chuyên edit.',
          price: 10990000, original: 12990000, featured: 0, shop: 1
        },
        {
          name: 'Samsung Galaxy Watch 6 Classic 47mm',
          img: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=800&q=80',
          short: 'Viền xoay cơ học, đo điện tâm đồ, theo dõi giấc ngủ.',
          desc: 'Galaxy Watch 6 Classic hồi sinh vành bezel xoay huyền thoại — thao tác chính xác mà không cần chạm màn hình. Màn hình Super AMOLED 1.5" luôn bật. Cảm biến BioActive 3-in-1: nhịp tim, ECG điện tâm đồ, thành phần cơ thể. Theo dõi giấc ngủ 4 giai đoạn kèm Sleep Coaching. GPS tích hợp, kháng nước 5ATM + IP68. Pin cho 40 giờ dùng, sạc nhanh. Chip Exynos W930.',
          price: 8990000, original: 10990000, featured: 0, shop: 1
        },
        {
          name: 'Anker PowerCore 24K Pin sạc dự phòng 140W',
          img: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=800&q=80',
          short: '24000mAh, output 140W, sạc MacBook Pro trong 40 phút.',
          desc: 'Anker PowerCore 24K sử dụng công nghệ GaNPrime mới nhất — công suất 140W qua USB-C đủ sạc MacBook Pro 16" từ 0 lên 50% trong 40 phút. Dung lượng 24000mAh đủ sạc iPhone 15 Pro Max 4.8 lần. 3 cổng (2x USB-C PD + 1x USB-A). Màn hình thông minh hiển thị công suất và thời gian sạc còn lại. Bảo vệ quá nhiệt ActiveShield 2.0. Được TSA cho phép mang lên máy bay.',
          price: 3490000, original: 4290000, featured: 0, shop: 1
        },
        {
          name: 'Xiaomi Mi Robot Vacuum S10+ Robot hút bụi lau nhà',
          img: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
          short: 'LDS navigation, lực hút 4000Pa, lau rung 3000 lần/phút.',
          desc: 'Robot hút bụi Xiaomi S10+ trang bị LDS laser 360° quét map chính xác, thuật toán SLAM lập kế hoạch đường đi tối ưu. Lực hút 4000Pa hút sạch bụi, tóc, lông thú. Mô-đun lau rung điện 3000 lần/phút loại bỏ vết bẩn cứng đầu. Pin 5200mAh dọn 250m² không cần sạc. Ứng dụng Mi Home điều khiển từ xa, tạo vùng cấm, lịch dọn. Tự động quay về dock sạc khi hết pin.',
          price: 8990000, original: 12990000, featured: 1, shop: 1
        },
        {
          name: 'Máy lọc không khí Xiaomi Smart Air Purifier 4 Pro',
          img: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=800&q=80',
          short: 'Diện tích 60m², màn OLED, lọc HEPA H13.',
          desc: 'Máy lọc không khí Xiaomi Air Purifier 4 Pro với CADR 500m³/h phủ căn phòng 35-60m² chỉ trong 10 phút. Màng lọc 3 lớp HEPA H13 loại bỏ 99.97% hạt bụi PM2.5, vi khuẩn, virus, mùi hôi và formaldehyde. Màn hình OLED hiển thị chất lượng không khí real-time, nhiệt độ, độ ẩm. Điều khiển qua Mi Home, Google Assistant, Alexa. Chế độ đêm cực êm 33dB. Cảm biến laser chính xác.',
          price: 6490000, original: 8490000, featured: 0, shop: 1
        },
        {
          name: 'Apple AirPods Pro 2 USB-C',
          img: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=800&q=80',
          short: 'Chip H2, chống ồn gấp đôi, Adaptive Audio.',
          desc: 'AirPods Pro 2 thế hệ USB-C với chip Apple H2 mới — chống ồn chủ động mạnh gấp 2 lần thế hệ trước. Tính năng Adaptive Audio kết hợp thông minh giữa Active Noise Cancellation và Transparency Mode. Chế độ Conversation Awareness tự động giảm âm lượng khi bạn nói chuyện. Âm thanh không gian được cá nhân hóa. Chống mồ hôi và nước IP54. Hộp sạc MagSafe/USB-C/Qi. Pin 6 giờ (30 giờ với hộp).',
          price: 5990000, original: 6490000, featured: 1, shop: 1
        }
      ],
      'Fashion': [
        {
          name: 'Nike Air Force 1 \'07 White Classic',
          img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
          short: 'Biểu tượng sneaker bất hủ, da bò thật, đế Air.',
          desc: 'Nike Air Force 1 \'07 — biểu tượng sneaker đường phố từ 1982, vẫn giữ nguyên phom dáng kinh điển. Upper da bò thật mềm mại, bền bỉ, ôm chân theo thời gian. Đế Nike Air encapsulated mang lại sự êm ái suốt cả ngày. Đường may rõ nét, logo Swoosh da đi kèm tag "AF-1" ở mặt bên. Đế cao su waffle tạo độ bám tốt. Form dáng chuẩn, đóng hộp nguyên seal chính hãng Nike Vietnam.',
          price: 2890000, original: 3290000, featured: 1, shop: 2
        },
        {
          name: 'Adidas Ultraboost Light Giày chạy bộ',
          img: 'https://images.unsplash.com/photo-1587563871167-1ee7c735df57?auto=format&fit=crop&w=800&q=80',
          short: 'BOOST Light nhẹ nhất từ trước tới nay, Primeknit ôm chân.',
          desc: 'Adidas Ultraboost Light là phiên bản Ultraboost nhẹ nhất từng có — midsole BOOST Light cải tiến giảm 30% trọng lượng so với BOOST cổ điển nhờ cấu trúc phân tử mới. Upper Primeknit+ ôm chân như tất, thoáng khí. Đế Continental Rubber bám đường mọi điều kiện. Linear Energy Push stabilizer hỗ trợ đẩy đầu ngón chân khi chạy. Giảm 10% carbon footprint so với thế hệ cũ. Phù hợp chạy bộ hàng ngày và long-run.',
          price: 4690000, original: 5290000, featured: 1, shop: 2
        },
        {
          name: 'Levi\'s 501 Original Fit Quần jeans nam',
          img: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=800&q=80',
          short: 'Dáng thẳng cổ điển, 100% cotton, nút đồng.',
          desc: 'Levi\'s 501 — chiếc jeans cổ điển nhất thế giới từ 1873. Chất liệu 100% cotton denim 14oz bền, càng mặc càng đẹp. Dáng Original Fit thẳng suốt, không bó, không rộng. Rise trung bình, khuy cài kim loại 5 chiếc. 5 túi kinh điển, đường may đôi màu cam đặc trưng Levi\'s. Patch da phía sau thắt lưng. Có sẵn nhiều màu wash: Dark Stonewash, Medium Wash, Light Blue, Black. Cut form theo size Mỹ.',
          price: 1890000, original: 2490000, featured: 0, shop: 2
        },
        {
          name: 'Uniqlo AIRism Ultra Light Down áo phao siêu nhẹ',
          img: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80',
          short: 'Lông vũ thật, trọng lượng chỉ 190g, có túi đựng.',
          desc: 'Áo phao siêu nhẹ Uniqlo Ultra Light Down nhồi 90% lông vũ xám chất lượng cao — giữ ấm ngang áo dày nhưng chỉ nặng 190g. Lớp vải AIRism co giãn, chống thấm nước nhẹ. Thiết kế gấp gọn vào túi đựng có sẵn — mang theo tiện lợi khi du lịch. Cổ đứng giữ ấm, túi khóa zip 2 bên. 8 màu cho cả nam nữ. Phù hợp từ 5-15°C, đi phượt, du lịch Nhật/Hàn/Châu Âu mùa thu.',
          price: 1490000, original: 1990000, featured: 0, shop: 2
        },
        {
          name: 'Ray-Ban Aviator Classic RB3025 kính mát',
          img: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=800&q=80',
          short: 'Biểu tượng từ 1937, tròng G-15 chống UV400.',
          desc: 'Ray-Ban Aviator Classic — mẫu kính biểu tượng được thiết kế cho phi công Mỹ từ 1937. Khung kim loại metal phủ gold thật, mũi cao su êm. Tròng G-15 màu xanh lá đặc trưng Ray-Ban — chống UV400 100%, lọc 85% ánh sáng khả kiến. Kích thước 58mm phù hợp khuôn mặt trung bình đến lớn. Bảo vệ mắt khỏi tia UVA/UVB. Tặng kèm bao da Ray-Ban chính hãng, khăn lau và thẻ bảo hành Luxottica.',
          price: 3890000, original: 4590000, featured: 1, shop: 2
        },
        {
          name: 'Casio G-Shock GA-2100 CasiOak đồng hồ nam',
          img: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=800&q=80',
          short: 'Thiết kế CasiOak bát giác, chống nước 200m, pin 3 năm.',
          desc: 'Casio G-Shock GA-2100 được fan đặt biệt danh "CasiOak" nhờ hình dáng bát giác gợi nhớ AP Royal Oak nhưng giá chỉ bằng 1%. Thân carbon core guard siêu bền, chống va đập. Chống nước 200m. Kim và số hiển thị analog kết hợp digital. Đèn LED cả kim và mặt số. Báo thức, stopwatch, countdown, lịch vạn niên đến 2099. Pin CR2025 dùng 3 năm. Trọng lượng chỉ 52g — đeo cả ngày không mỏi.',
          price: 2290000, original: 2690000, featured: 0, shop: 2
        },
        {
          name: 'Charles & Keith Túi xách nữ Classic Top Handle',
          img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
          short: 'Da PU cao cấp, quai xách + dây đeo chéo, đủ không gian cho iPad Mini.',
          desc: 'Túi xách Classic Top Handle của Charles & Keith — chiếc túi must-have cho phong cách công sở sang trọng. Chất liệu da PU cao cấp vân mịn, chống trầy tốt. Quai xách cứng cáp, dây đeo chéo điều chỉnh tháo rời. Bên trong lót vải sateen, 1 ngăn chính + 2 túi nhỏ + 1 ngăn khóa kéo. Kích thước 28x20x10cm vừa đựng iPad Mini, ví, mỹ phẩm. 6 màu: Đen, Nude, Trắng, Hồng pastel, Nâu caramel, Xanh navy.',
          price: 1590000, original: 1990000, featured: 0, shop: 2
        },
        {
          name: 'Zara Trench Coat áo khoác măng tô nữ',
          img: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80',
          short: 'Form dáng cổ điển, chất liệu water-repellent, 2 hàng nút.',
          desc: 'Trench Coat cổ điển Zara — item không thể thiếu cho tủ đồ thu đông. Chất liệu polyester pha cotton chống thấm nhẹ, không thấm mưa phùn. Thiết kế 2 hàng nút đặc trưng, dây thắt eo cùng chất liệu, epaulette vai. Cổ bẻ có thể dựng đứng chắn gió. Túi 2 bên có khóa. Lót lụa satin mát. Form dài quá gối — phù hợp cao 1m55-1m70. Dễ phối với jeans, váy midi, quần âu công sở.',
          price: 2590000, original: 3290000, featured: 0, shop: 2
        },
        {
          name: 'Vans Old Skool giày vải unisex',
          img: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=800&q=80',
          short: 'Sọc Sidestripe kinh điển, đế waffle, phù hợp mọi outfit.',
          desc: 'Vans Old Skool ra mắt 1977 là đôi Vans đầu tiên có logo Sidestripe huyền thoại. Upper canvas và suede bền chắc, chống trầy. Đế Vans waffle tạo độ bám đặc trưng, cộng đệm Vans Classic êm chân. Lót trong padded collar tăng độ ôm. Kiểu dáng low-top unisex đi cực kỳ linh hoạt: jeans, short, váy, đồ thể thao. Nhiều màu: Black/White, All Black, True White, Checkerboard, Navy/White.',
          price: 1690000, original: 1990000, featured: 0, shop: 2
        },
        {
          name: 'Áo polo nam Lacoste L.12.12 Classic Fit',
          img: 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?auto=format&fit=crop&w=800&q=80',
          short: 'Vải piqué cotton, logo cá sấu thêu, 20+ màu.',
          desc: 'Áo polo Lacoste L.12.12 là chiếc áo polo được tạo ra bởi chính René Lacoste năm 1933. Vải Petit Piqué cotton 100% — dệt đặc trưng tạo bề mặt mềm và thoáng mát, không nhăn. Logo cá sấu thêu tay truyền thống ở ngực trái. Cổ bẻ 2 nút, gấu áo dài phía sau (tennis tail) che được eo khi ngồi. Classic Fit ôm vừa không bó. Có sẵn từ S tới XXXL, hơn 20 màu sắc. Giặt máy, không cần ủi.',
          price: 2890000, original: 3490000, featured: 0, shop: 2
        },
        {
          name: 'Thắt lưng da bò thật Coach Harness Belt',
          img: 'https://images.unsplash.com/photo-1624222247301-52402a643891?auto=format&fit=crop&w=800&q=80',
          short: 'Da bò Italy, khóa đồng thau, rộng 3.8cm.',
          desc: 'Thắt lưng Coach Harness được làm từ da bò Italy nhập khẩu, dày 4mm — mềm dẻo tự nhiên và càng dùng càng đẹp. Bề mặt phủ lớp bảo vệ không trầy xước. Khóa đồng thau solid brass nặng tay, phay CNC sắc nét, không rỉ sét. 5 lỗ chỉnh kích cỡ. Có 2 bản: bản 3.8cm cho quần jeans/kaki, bản 3cm cho quần âu công sở. Tặng kèm hộp giấy cao cấp và túi vải.',
          price: 2190000, original: 2890000, featured: 0, shop: 2
        },
        {
          name: 'Ví da nam Montblanc Meisterstück Bi-Fold',
          img: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80',
          short: 'Da bê Ý, 6 ngăn thẻ, công nghệ RFID bảo mật.',
          desc: 'Ví da Montblanc Meisterstück là biểu tượng của đẳng cấp — chất liệu da bê Italy full-grain, bề mặt nhẵn mịn tự nhiên. Bên trong có 6 ngăn đựng thẻ tín dụng, 2 ngăn giấy tờ, 1 ngăn tiền giấy rộng. Lớp chống sóng RFID bảo vệ thẻ từ trộm. Logo ngôi sao Montblanc thêu nổi ở góc. Dáng bi-fold mỏng, nhét vừa túi quần tây không cộm. Hộp gỗ đen với chứng nhận bảo hành quốc tế 2 năm.',
          price: 8990000, original: 10990000, featured: 1, shop: 2
        },
        {
          name: 'Áo hoodie nỉ bông Champion Reverse Weave',
          img: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80',
          short: 'Bông heavyweight 12oz, không co rút, unisex.',
          desc: 'Champion Reverse Weave là chiếc hoodie biểu tượng của thể thao Mỹ từ 1938. Công nghệ Reverse Weave dệt ngang thay vì dọc — chống co rút dù giặt 1000 lần. Chất nỉ bông 82% cotton + 18% polyester 12oz, dày và ấm. Túi kangaroo lớn đựng đồ tiện lợi, mũ trùm 2 lớp. Khóa kéo YKK bền. Logo C thêu ở ngực trái, big-C lớn ở tay. Form unisex rộng rãi, phù hợp layer bên trong áo khoác. 15+ màu.',
          price: 2190000, original: 2890000, featured: 0, shop: 2
        },
        {
          name: 'Quần short thể thao Nike Dri-FIT Challenger 7"',
          img: 'https://images.unsplash.com/photo-1515488825862-8e98d8801cdb?auto=format&fit=crop&w=800&q=80',
          short: 'Thấm hút mồ hôi, quần lót liền trong, phản quang.',
          desc: 'Quần short chạy bộ Nike Challenger 7 inch với công nghệ Dri-FIT thấm hút mồ hôi nhanh. Chiều dài gối 7 inch — không quá ngắn không quá dài. Quần lót thun liền bên trong hỗ trợ. Dây rút eo điều chỉnh. Túi khóa kéo phía sau đựng điện thoại. Chi tiết phản quang mặt sau cho chạy buổi tối. Vải polyester 100% siêu nhẹ, khô nhanh. Giặt máy. Phù hợp chạy, gym, yoga, đạp xe.',
          price: 890000, original: 1190000, featured: 0, shop: 2
        }
      ],
      'Beauty': [
        {
          name: 'Estée Lauder Advanced Night Repair Serum 50ml',
          img: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
          short: 'Serum chống lão hóa #1 Mỹ, bản 2024 Chronolux Power Signal.',
          desc: 'Estée Lauder Advanced Night Repair — serum bestseller hơn 40 năm với công nghệ Chronolux Power Signal tối ưu cho ban đêm. Hyaluronic Acid + Tripeptide-32 phục hồi nhiều lớp biểu bì, giảm nếp nhăn. Chống oxy hóa bảo vệ khỏi stress môi trường. Kết cấu serum lỏng, thẩm thấu nhanh, không bết dính. Phù hợp mọi loại da kể cả da nhạy cảm. Kiểm định da liễu. Chứng nhận không paraben, không phthalates. Dùng 2 lần/ngày sau toner.',
          price: 2890000, original: 3490000, featured: 1, shop: 3
        },
        {
          name: 'SK-II Facial Treatment Essence 230ml',
          img: 'https://images.unsplash.com/photo-1608248597279-f99d160bfbc8?auto=format&fit=crop&w=800&q=80',
          short: 'Nước thần PITERA™, dưỡng sáng và đều màu da.',
          desc: 'SK-II Facial Treatment Essence được mệnh danh "Nước thần" — chứa hơn 90% Pitera™ galactomyces ferment filtrate, thành phần độc quyền tinh chế từ quá trình lên men 40 năm. Axit amin, vitamin, khoáng chất và axit hữu cơ tái tạo tế bào da. Sau 14 ngày, da sáng mịn, lỗ chân lông thu nhỏ. Kết cấu nước trong, thấm ngay. Sử dụng sau sữa rửa mặt, trước serum. Bản chai thủy tinh lớn 230ml dùng được 3-4 tháng.',
          price: 5990000, original: 6990000, featured: 1, shop: 3
        },
        {
          name: 'La Roche-Posay Anthelios UV Mune 400 SPF50+',
          img: 'https://images.unsplash.com/photo-1556228720-388e40455e1b?auto=format&fit=crop&w=800&q=80',
          short: 'Kem chống nắng cho da nhạy cảm, không nhờn.',
          desc: 'Kem chống nắng La Roche-Posay Anthelios UV Mune 400 với công nghệ Mexoryl 400 độc quyền — chống tia UVA ultra-long (đến bước sóng 400nm) gây lão hóa và sạm da. SPF50+/PA++++ bảo vệ toàn diện UVA/UVB. Kết cấu Fluide lỏng, không nhờn, không vệt trắng, không gây mụn (non-comedogenic). An toàn cho da nhạy cảm, da atopic. Nước khoáng La Roche-Posay làm dịu da. Dùng được dưới lớp makeup. Dung tích 50ml cho 2-3 tháng.',
          price: 590000, original: 790000, featured: 0, shop: 3
        },
        {
          name: 'The Ordinary Niacinamide 10% + Zinc 1% Serum',
          img: 'https://images.unsplash.com/photo-1608248597279-f99d160bfbc8?auto=format&fit=crop&w=800&q=80',
          short: 'Giảm thâm mụn, kiểm soát dầu, se khít lỗ chân lông.',
          desc: 'Serum Niacinamide 10% + Zinc 1% của The Ordinary là sản phẩm bestseller toàn cầu với công thức tập trung cao. Niacinamide (Vitamin B3) giảm thâm sạm, điều tiết bã nhờn, thu nhỏ lỗ chân lông. Zinc PCA cân bằng dầu và kháng khuẩn. Không mùi, không màu, không gây kích ứng. Kết cấu serum mỏng thấm nhanh. Phù hợp da dầu mụn, da hỗn hợp, da có thâm. Dùng sáng/tối sau toner, trước kem dưỡng. Chai 30ml dùng 2 tháng.',
          price: 290000, original: 390000, featured: 0, shop: 3
        },
        {
          name: 'MAC Ruby Woo Son lì kinh điển',
          img: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80',
          short: 'Đỏ tươi ánh xanh, finish lì retro, bám 8 tiếng.',
          desc: 'MAC Ruby Woo — thỏi son đỏ được yêu thích nhất thế giới, ra mắt 1999 và trở thành huyền thoại. Tông đỏ tươi ánh xanh (blue-red) tôn răng trắng, phù hợp mọi tone da. Finish Retro Matte lì mờ sang trọng không bóng. Lên môi chuẩn màu, bám 8 tiếng không bay. Thấm vào môi làm lộ đường môi nên cần tẩy tế bào chết trước khi dùng. Không nhân tạo, kiểm định da liễu. Tuýp đen sang trọng 3g. Hộp carton tái chế.',
          price: 490000, original: 590000, featured: 1, shop: 3
        },
        {
          name: 'Dyson Airwrap Multi-Styler Complete Long',
          img: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
          short: 'Tạo kiểu tóc đa năng, hiệu ứng Coanda, không hại tóc.',
          desc: 'Dyson Airwrap sử dụng hiệu ứng Coanda — luồng không khí xoắn quanh đầu uốn, tự động hút và cuốn tóc vào đũa mà không cần nhiệt cao. Kiểm soát nhiệt thông minh 150°C bảo vệ độ bóng tự nhiên. 6 đầu uốn: curling barrel 40mm+30mm, Coanda smoothing dryer, soft/firm smoothing brush, round volumizing brush. Động cơ Dyson V9 công suất 1300W. Thiết kế cho tóc dài. Hộp da cao cấp, dây dài 2.7m. Bảo hành Dyson VN 2 năm.',
          price: 13990000, original: 15990000, featured: 1, shop: 3
        },
        {
          name: 'Nước hoa Dior Sauvage Eau de Parfum 100ml',
          img: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=800&q=80',
          short: 'Hương nam tính mạnh mẽ, bergamot + ambroxan, lưu 10h.',
          desc: 'Dior Sauvage EDP 100ml — nước hoa nam bán chạy nhất thế giới. Hương đầu bergamot Calabria tươi mát. Hương giữa sichuan pepper, hoa oải hương, nhục đậu khấu, elemi tạo chiều sâu quyến rũ. Hương cuối ambroxan, cedar, labdanum ấm nồng, gợi cảm. Nồng độ EDP lưu hương 10-12 giờ, tỏa hương khỏe trong bán kính 2m. Chai vuông đậm chất nam tính, xịt tinh xảo. Phù hợp mùa thu đông, dịp tối, hẹn hò, công sở.',
          price: 3490000, original: 3990000, featured: 1, shop: 3
        },
        {
          name: 'Chanel N°5 Eau de Parfum 100ml',
          img: 'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=800&q=80',
          short: 'Biểu tượng nước hoa nữ từ 1921, hương hoa cổ điển.',
          desc: 'Chanel N°5 — nước hoa nữ nổi tiếng nhất lịch sử, ra mắt 1921 bởi Gabrielle Chanel. Hương đầu neroli, ylang-ylang tươi sáng. Hương giữa hoa hồng May, hoa nhài Grasse nữ tính. Hương cuối vetiver, vanilla, sandalwood ấm áp. Lưu hương 8-10 giờ. Chai thủy tinh vuông cổ điển do chính Chanel thiết kế. Hộp trắng đơn giản với logo đôi CC đen. Phù hợp mọi dịp quan trọng, công sở, buổi tối trang trọng.',
          price: 5990000, original: 6890000, featured: 0, shop: 3
        },
        {
          name: 'Innisfree Green Tea Seed Serum 80ml',
          img: 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?auto=format&fit=crop&w=800&q=80',
          short: 'Serum cấp ẩm từ trà xanh Jeju, da bóng khỏe.',
          desc: 'Innisfree Green Tea Seed Serum chứa tinh chất trà xanh hữu cơ Jeju lên men — giàu amino acid và khoáng chất cấp ẩm sâu. Dầu hạt trà xanh củng cố hàng rào bảo vệ da. Kết cấu jelly mát lạnh, thấm nhanh, không nhờn. Không cồn, không paraben, không màu. Phù hợp mọi loại da kể cả da dầu mụn. Dùng sau toner, trước kem dưỡng. Chai 80ml lớn tiết kiệm. Xuất xứ Hàn Quốc, thương hiệu Innisfree chính hãng.',
          price: 590000, original: 790000, featured: 0, shop: 3
        },
        {
          name: 'Laneige Lip Sleeping Mask 20g',
          img: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80',
          short: 'Mặt nạ môi qua đêm vị berry, môi mềm sau 1 đêm.',
          desc: 'Laneige Lip Sleeping Mask — mặt nạ môi hàng đêm bestseller Hàn Quốc. Công thức Berry Mix Complex chứa vitamin C, resveratrol và chiết xuất từ mâm xôi, việt quất, dâu tằm. Enzyme trong công thức loại bỏ tế bào chết môi dịu nhẹ. Kết cấu thạch mát, thẩm thấu qua đêm, sáng ra môi mềm mọng hết nứt nẻ. Hương vị berry ngọt ngào. Hũ thủy tinh 20g dùng được 2-3 tháng. Tặng kèm cây múc silicon.',
          price: 390000, original: 490000, featured: 0, shop: 3
        },
        {
          name: 'Fenty Beauty Pro Filt\'r Soft Matte Foundation 32ml',
          img: 'https://images.unsplash.com/photo-1631214524049-0ebc3fc3b9d1?auto=format&fit=crop&w=800&q=80',
          short: '50 tone da, finish lì mờ, bám 24 giờ, không thấm nước.',
          desc: 'Fenty Beauty Foundation của Rihanna với 50 tone da từ nhạt nhất tới đậm nhất — fit mọi undertone. Công thức soft matte buildable — thoa mỏng trong suốt, thoa dày che phủ tốt. Chống thấm mồ hôi và nước, bám 24 giờ không trôi. Vitamin E dưỡng da. Không gây mụn, kiểm định da liễu. Dưới ánh sáng flash không bị vệt trắng (flashback-free). Vòi pump chính xác. Phù hợp mọi loại da, thời tiết nóng ẩm Việt Nam.',
          price: 990000, original: 1290000, featured: 0, shop: 3
        },
        {
          name: 'Tinh dầu Argan Moroccanoil 100ml',
          img: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
          short: 'Phục hồi tóc khô hư tổn, chống xoăn rối, dưỡng bóng.',
          desc: 'Moroccanoil Treatment là dầu dưỡng tóc Argan nổi tiếng toàn cầu từ 2008. Chiết xuất dầu Argan Morocco giàu vitamin E và acid béo thiết yếu. Phục hồi tóc khô hư tổn, chẻ ngọn do nhuộm và nhiệt. Thẩm thấu nhanh, không bết tóc, giúp tóc bóng mượt và dễ chải. Chống xoăn rối khi trời ẩm. Xịt lên tóc ẩm trước sấy hoặc tóc khô đã tạo kiểu. Chai vàng xanh đặc trưng, 100ml dùng 6 tháng cho tóc dài vừa.',
          price: 890000, original: 1190000, featured: 0, shop: 3
        }
      ],
      'Home & Living': [
        {
          name: 'Nồi cơm điện cao tần Zojirushi NW-JEC10 1L',
          img: 'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=800&q=80',
          short: 'IH Induction Heating, 10 chế độ nấu, cơm thơm như hàng Nhật.',
          desc: 'Nồi cơm điện Zojirushi NW-JEC10 sử dụng công nghệ IH cao tần — sinh nhiệt trực tiếp vào lòng nồi, kiểm soát nhiệt chính xác từng vùng. Lòng nồi Platinum Infused Nonstick bền bỉ 10+ năm. 10 chế độ: trắng, lứt, sushi, cháo, hấp, chạy bộ gạo, keep warm. Công nghệ Umami giảm tinh bột dư thừa, cơm ngọt tự nhiên. Nắp đôi cách nhiệt giữ ấm 24h mà không khô. Mâm nhiệt đáy đôi. Dung tích 1L nấu cho 2-6 người. Nhập khẩu Nhật chính hãng.',
          price: 12990000, original: 15990000, featured: 1, shop: 1
        },
        {
          name: 'Máy pha cà phê Breville Barista Express BES870',
          img: 'https://images.unsplash.com/photo-1570486829512-39cfdc5a9e4e?auto=format&fit=crop&w=800&q=80',
          short: 'Cối xay tích hợp, áp suất 15 bar, steam wand chuyên nghiệp.',
          desc: 'Breville Barista Express là máy pha cà phê espresso bán tự động nổi tiếng nhất thế giới. Cối xay burr conical tích hợp 18 mức độ xay, tamping điện tử đều tay. Áp suất 15 bar chuẩn barista. Steam wand 360° tạo bọt sữa latte art. Bơm Italy chính hãng. Hệ thống pre-infusion làm mềm cà phê trước khi chiết xuất. Nhiệt kế PID chính xác đến 0.5°C. Bình sữa không BPA. Inox sáng bóng. Bảo hành chính hãng 2 năm.',
          price: 17990000, original: 21990000, featured: 1, shop: 1
        },
        {
          name: 'Bộ chăn ga gối Cotton Ai Cập Sleep Number King',
          img: 'https://images.unsplash.com/photo-1583845112203-29329902332e?auto=format&fit=crop&w=800&q=80',
          short: 'Cotton Ai Cập 1000 thread-count, kháng khuẩn, mát mịn.',
          desc: 'Bộ chăn ga gối cao cấp dệt từ cotton Ai Cập long-staple 1000 thread-count — mật độ sợi cao tạo bề mặt mát mịn như lụa. Wash kỹ thuật Sanforized chống co rút. Kháng khuẩn OEKO-TEX Standard 100. Bao gồm: 1 ga giường King 180x200cm, 2 vỏ gối 50x70cm, 1 vỏ chăn 230x250cm. Khóa kéo ẩn. 5 màu trung tính: trắng, kem, xám khói, xanh dương pastel, hồng phấn. Giặt máy 40°C, bền 5+ năm sử dụng hàng ngày.',
          price: 3490000, original: 4890000, featured: 0, shop: 1
        },
        {
          name: 'Máy hút bụi cầm tay Dyson V15 Detect',
          img: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=800&q=80',
          short: 'Laser phát hiện bụi mịn, lực hút 240AW, pin 60 phút.',
          desc: 'Dyson V15 Detect có đèn laser trên đầu hút Fluffy — chiếu sáng xiên 1.5° phát hiện bụi vô hình mà mắt thường không thấy. Màn hình LCD báo kích thước và số lượng hạt bụi real-time. Động cơ Dyson Hyperdymium 125,000 vòng/phút tạo lực hút 240AW. Pin tháo rời dùng tới 60 phút. Lọc HEPA H13 giữ 99.99% bụi mịn. 8 đầu hút chuyên dụng cho sàn cứng, thảm, đệm, khe hẹp, xe hơi. Bảo hành 2 năm Dyson Vietnam.',
          price: 18990000, original: 23990000, featured: 1, shop: 1
        },
        {
          name: 'Nồi chiên không dầu Philips Essential XL HD9270',
          img: 'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=800&q=80',
          short: 'Dung tích 6.2L, công nghệ Rapid Air, giảm 90% dầu.',
          desc: 'Philips Essential Airfryer XL HD9270 dung tích lớn 6.2L (1.2kg thức ăn) đủ cho gia đình 4-5 người. Công nghệ Rapid Air độc quyền xoáy luồng khí nóng 200°C đều xung quanh, làm món ăn vàng giòn giảm 90% dầu mỡ. 13 chế độ preset: khoai tây chiên, gà rán, cá, nướng, sấy hoa quả... Khay chống dính QuickClean rửa máy. Ngắt tự động, khóa an toàn trẻ em. Công suất 2000W. Bảo hành 2 năm Philips Vietnam.',
          price: 3490000, original: 4490000, featured: 0, shop: 1
        },
        {
          name: 'Bộ nồi inox 304 Fissler Original Pro 5 món',
          img: 'https://images.unsplash.com/photo-1584990347449-a5d9f800a783?auto=format&fit=crop&w=800&q=80',
          short: 'Inox 18/10 Đức, 3 lớp đáy từ, dùng được bếp từ.',
          desc: 'Bộ nồi Fissler Original Pro Collection gồm: nồi 4.6L, nồi 2.6L, nồi 1.8L, chảo 24cm, vỉ hấp. Chất liệu inox 18/10 Đức cao cấp không ố vàng. Đáy 3 lớp inox-nhôm-inox dày 6mm truyền nhiệt đều, nhanh. Tương thích mọi loại bếp: từ, hồng ngoại, gas, điện. Quai cầm inox mát tay. Nắp inox có đo milimét trong lòng nồi. Rót nước không tràn nhờ viền cong. An toàn máy rửa chén. Bảo hành 30 năm nhà sản xuất.',
          price: 8990000, original: 12990000, featured: 0, shop: 1
        },
        {
          name: 'Đèn bàn IKEA FORSÅ Work Lamp',
          img: 'https://images.unsplash.com/photo-1507473888900-52e1adad54cd?auto=format&fit=crop&w=800&q=80',
          short: 'Thép phủ sơn tĩnh điện, cánh tay linh hoạt, kinh điển.',
          desc: 'Đèn bàn IKEA FORSÅ — thiết kế cổ điển phong cách Bắc Âu từ 1980. Khung thép phủ sơn tĩnh điện đen bền bỉ. Cánh tay 2 khớp xoay linh hoạt, điều chỉnh độ sáng theo vị trí làm việc. Đui E27 tương thích bóng LED tiết kiệm điện (không bao gồm). Công tắc xoắn dưới chân đèn. Chân đế nặng chống đổ. Phù hợp bàn làm việc, bàn đọc sách, bàn trang điểm. Dễ lắp ráp, bảo hành 1 năm IKEA.',
          price: 590000, original: 790000, featured: 0, shop: 1
        },
        {
          name: 'Máy xay sinh tố Vitamix A3500 Ascent Series',
          img: 'https://images.unsplash.com/photo-1570126646281-5ec88111777f?auto=format&fit=crop&w=800&q=80',
          short: 'Công suất 1500W, 5 chế độ tự động, cối polycarbonate chịu nhiệt.',
          desc: 'Vitamix A3500 Ascent Series là máy xay sinh tố đẳng cấp nhà hàng. Động cơ 1500W, 2.2HP xay mọi thứ từ đá lạnh đến hạt cứng. 5 chế độ tự động: smoothie, sốt, súp nóng (xay ma sát tạo nhiệt 80°C), kem, rửa. Màn hình cảm ứng + núm xoay tốc độ. Cối polycarbonate Eastman Tritan chịu nhiệt, không BPA 2L. Công nghệ Wireless Connectivity kết nối app Vitamix. Chân cao su chống trượt. Bảo hành 10 năm.',
          price: 14990000, original: 17990000, featured: 1, shop: 1
        },
        {
          name: 'Máy lọc nước RO Karofi KAQ-U05 10 lõi',
          img: 'https://images.unsplash.com/photo-1628615032942-3a46d65f3dd5?auto=format&fit=crop&w=800&q=80',
          short: '10 cấp lọc RO + Hydrogen + Alkaline, bình áp 10L.',
          desc: 'Máy lọc nước Karofi KAQ-U05 với 10 cấp lọc: 3 lõi thô PP + GAC + CTO loại bỏ cặn, clo. Lõi RO Filmtec DOW 100GPD loại bỏ 99.99% vi khuẩn, kim loại nặng, virus. 4 lõi chức năng bổ sung khoáng, tạo kiềm pH 8.5-9.5, tạo hydrogen chống oxy hóa, T33 GAC làm ngọt. Bình áp 10L thép không gỉ. Đèn báo thay lõi tự động. Tủ kim loại sơn tĩnh điện bảo vệ. Lắp đặt và bảo hành Karofi VN 3 năm.',
          price: 5990000, original: 7990000, featured: 0, shop: 1
        },
        {
          name: 'Chậu cây gốm Scandi Minimalist set 3',
          img: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80',
          short: 'Gốm sứ nung cao 1200°C, 3 kích cỡ, đĩa lót tre.',
          desc: 'Bộ chậu cây gốm minimalist phong cách Scandinavia gồm 3 chậu kích cỡ nhỏ-vừa-lớn (10cm/15cm/20cm đường kính). Chất liệu gốm sứ nung ở 1200°C, bề mặt matte trắng kem. Mỗi chậu có lỗ thoát nước và đĩa tre đi kèm chống thấm bàn. Phù hợp xương rồng, succulent, lưỡi hổ, cây nhỏ. Thiết kế hình học đơn giản hợp mọi không gian: bàn làm việc, cửa sổ, kệ sách, bậu cửa. Đóng gói hộp carton an toàn vận chuyển. Không bao gồm cây.',
          price: 490000, original: 690000, featured: 0, shop: 1
        }
      ],
      'Sports': [
        {
          name: 'Thảm yoga Lululemon The Mat 5mm',
          img: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?auto=format&fit=crop&w=800&q=80',
          short: 'Cao su thiên nhiên, 2 mặt grip khác nhau, 5mm êm gối.',
          desc: 'Thảm yoga Lululemon The Mat 5mm với 2 mặt: mặt polyurethane trên hút ẩm khi ra mồ hôi tạo grip mạnh cho Hot Yoga; mặt cao su thiên nhiên dưới chống trượt tuyệt đối trên sàn gỗ/gạch. Độ dày 5mm êm ái cho khớp gối và hông trong asana sâu. Chất liệu kháng khuẩn tự nhiên chống mốc. Kích thước 180x66cm (có bản dài 213cm riêng). Dây buộc silicone đi kèm. Dễ lau bằng khăn ẩm, không cần xà phòng.',
          price: 2490000, original: 2890000, featured: 1, shop: 1
        },
        {
          name: 'Tạ tay điều chỉnh Bowflex SelectTech 552',
          img: 'https://images.unsplash.com/photo-1638536532686-d610adfc8e5c?auto=format&fit=crop&w=800&q=80',
          short: 'Thay 15 cặp tạ, xoay núm từ 2kg đến 24kg, tiết kiệm không gian.',
          desc: 'Tạ tay Bowflex SelectTech 552 — 1 cặp thay thế 15 cặp tạ thường. Xoay núm vặn đổi trọng lượng từ 2.27kg đến 23.8kg theo bước 1.1kg hoặc 2.3kg. Đĩa tạ đúc cứng cáp phủ nhựa chống xước sàn. Tay cầm ergonomic có đệm êm, không trơn khi ra mồ hôi. Giá đựng tạ chắc chắn đi kèm. Công nghệ SelectTech đảm bảo đĩa không kẹt tay. Phù hợp tập home gym: curl, press, flye, row, squat. Bảo hành 2 năm.',
          price: 8990000, original: 11990000, featured: 1, shop: 1
        },
        {
          name: 'Xe đạp gấp Dahon K3 14 inch',
          img: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
          short: 'Khung nhôm, nặng 7.8kg, 3 tốc độ, gấp trong 15 giây.',
          desc: 'Dahon K3 là xe đạp gấp siêu nhẹ chỉ 7.8kg với khung nhôm hàng không. Bánh 14 inch nhỏ gọn nhưng tay lái cao nên người 1m60-1m85 đi thoải mái. Hệ thống gấp 4 điểm của Dahon gấp trong 15 giây còn kích thước 65x59x28cm — cất cốp xe, thang máy, văn phòng dễ dàng. Shimano 3 tốc độ nội trục trong bánh trước, không cần bảo dưỡng. Phanh V-brake. Yên điều chỉnh cao. Giao hàng lắp ráp sẵn. Bảo hành khung 5 năm.',
          price: 12990000, original: 14990000, featured: 0, shop: 1
        },
        {
          name: 'Bóng rổ Spalding NBA Street Phantom size 7',
          img: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80',
          short: 'Cao su tổng hợp bền outdoor, size tiêu chuẩn NBA.',
          desc: 'Bóng rổ Spalding NBA Street Phantom size 7 (29.5") — trọng lượng 567-624g tiêu chuẩn NBA. Bề mặt cao su tổng hợp xuyên lõi, nẩy tốt trên mọi sân xi măng, nhựa, gỗ. Rãnh sâu deep channel giúp cầm nắm chắc ngay cả khi ra mồ hôi. Logo NBA chính hãng. Đã bơm sẵn, tặng kèm kim bơm dự phòng. Chịu được tập outdoor 2-3 năm. Size 7 cho nam trên 13 tuổi. Có size 6 (28.5") cho nữ và size 5 (27.5") cho trẻ em.',
          price: 690000, original: 890000, featured: 0, shop: 1
        },
        {
          name: 'Vợt cầu lông Yonex Astrox 88D Pro (2024)',
          img: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80',
          short: 'Đánh đôi mạnh, frame Namd, cân bằng đầu nặng.',
          desc: 'Vợt Yonex Astrox 88D Pro thế hệ 2024 chuyên cho tay đôi phía sau (rear court). Khung Namd graphite chất liệu cao cấp giữ được độ dẻo và sức mạnh. Head-heavy balance tạo lực đập cực mạnh. Trọng lượng 4U (83g) căng 27lbs. Grip G5 phù hợp tay châu Á. Công nghệ Rotational Generator System tập trung trọng lượng ở đầu vợt tăng xoay vợt smash. Quang Chính Kento Momota đã dùng mẫu này thi đấu. Tặng kèm bao vợt, dây BG65 căng sẵn.',
          price: 3990000, original: 4690000, featured: 0, shop: 1
        },
        {
          name: 'Máy chạy bộ điện Xiaomi Mi Smart Treadmill Pro',
          img: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=800&q=80',
          short: 'Động cơ 2.0HP, tốc độ 0.8-16km/h, gấp gọn.',
          desc: 'Máy chạy bộ Xiaomi Mi Smart Treadmill Pro với động cơ AC 2.0HP chạy mượt liên tục 3 giờ. Tốc độ 0.8-16km/h, 12 chế độ tập định sẵn. Băng chạy 1200x500mm đệm nhún 5 lớp giảm chấn khớp gối. Màn hình LCD 7" hiển thị tốc độ, khoảng cách, calo, nhịp tim. Kết nối Mi Fit tracking tiến độ. Gấp dọc tiết kiệm không gian. Bánh xe di chuyển. Sàn chống trơn, tay vịn có cảm biến nhịp tim, nút dừng khẩn cấp. Chịu tải 100kg. Bảo hành 2 năm.',
          price: 9990000, original: 12990000, featured: 1, shop: 1
        },
        {
          name: 'Bóng đá Adidas Al Rihla FIFA World Cup 2022',
          img: 'https://images.unsplash.com/photo-1614632537190-23e4146777db?auto=format&fit=crop&w=800&q=80',
          short: 'Bóng thi đấu chính thức WC 2022, size 5, chuẩn FIFA.',
          desc: 'Bóng đá Adidas Al Rihla — bóng chính thức FIFA World Cup Qatar 2022. Công nghệ CTR-CORE cải tiến độ nẩy và tốc độ. Panel SpeedShell tạo ra bóng ổn định trong không khí ở tốc độ cao. Bề mặt in hoa văn lấy cảm hứng từ cờ Qatar và kiến trúc địa phương. FIFA Quality Pro chuẩn thi đấu quốc tế. Size 5 chu vi 68-70cm, nặng 410-450g. Tặng kim bơm. Đã bơm căng sẵn. Phù hợp sân cỏ nhân tạo và tự nhiên.',
          price: 1290000, original: 1690000, featured: 0, shop: 1
        },
        {
          name: 'Balo đi phượt Osprey Atmos AG 65L',
          img: 'https://images.unsplash.com/photo-1622560480654-d96214fdc887?auto=format&fit=crop&w=800&q=80',
          short: 'Anti-Gravity suspension, lưng thông thoáng, chứa 65L.',
          desc: 'Balo Osprey Atmos AG 65L chuyên trekking dài ngày. Hệ thống Anti-Gravity độc quyền — khung lưới 3D nâng đỡ trải đều áp lực toàn lưng, thông thoáng tuyệt đối. Đai hông tự điều chỉnh theo hông. Dây vai pivoting. Nhiều ngăn: ngăn chính 50L có cửa mặt trước, ngăn sleeping bag dưới, 2 ngăn hông, 2 ngăn đai hông, ngăn top-lid tháo rời. Chống nước nhẹ. Phủ UPF50. Phù hợp trekking 3-7 ngày. Bảo hành All Mighty Guarantee trọn đời.',
          price: 7490000, original: 8990000, featured: 0, shop: 1
        },
        {
          name: 'Găng tay boxing Twins Special BGVL3 14oz',
          img: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=800&q=80',
          short: 'Da bò thật Thái Lan, đúc thủ công, độ bền cao.',
          desc: 'Găng tay boxing Twins Special BGVL3 — thương hiệu Thái Lan được dân Muay Thái chuyên nghiệp tin dùng 40 năm. Da bò thật full-grain cao cấp nhập từ Mỹ, khâu tay tại Thái Lan. Foam đệm đa lớp 3 mật độ bảo vệ khớp ngón và lòng tay. Dây velcro chắc chắn, đóng mở nhanh. Khe thông khí mặt trong tránh hôi. Size 14oz phù hợp nam 70-80kg tập sparring và túi. 20+ màu. Bền 5+ năm tập thường xuyên. Bảo hành lỗi may 6 tháng.',
          price: 1890000, original: 2390000, featured: 0, shop: 1
        }
      ],
      'Books': [
        {
          name: 'Sách Atomic Habits — James Clear (Tiếng Việt)',
          img: 'https://images.unsplash.com/photo-1592496431122-2349e0fbc666?auto=format&fit=crop&w=800&q=80',
          short: 'Thói quen nguyên tử: xây thói quen tốt, bỏ thói quen xấu.',
          desc: 'Atomic Habits của James Clear đã bán hơn 15 triệu bản toàn cầu. Sách trình bày khung khoa học để xây dựng thói quen: 1% mỗi ngày tạo ra thay đổi lớn qua thời gian. 4 luật thay đổi hành vi: Make it Obvious, Attractive, Easy, Satisfying. Hàng trăm case study thực tế. Bản tiếng Việt do Alpha Books xuất bản, dịch giả Nguyễn Hoàng Linh. 352 trang, bìa mềm, khổ 14x20.5cm. In offset 4 màu, giấy Fort trắng nhẹ mắt. Tặng kèm bookmark.',
          price: 169000, original: 219000, featured: 1, shop: 2
        },
        {
          name: 'Combo Sapiens + Homo Deus — Yuval Noah Harari',
          img: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=800&q=80',
          short: 'Lược sử loài người + Lược sử tương lai, bộ 2 cuốn tiếng Việt.',
          desc: 'Bộ 2 cuốn bestseller của Yuval Noah Harari đã làm chấn động giới trí thức toàn cầu. Sapiens: Lược sử loài người — khảo sát 70.000 năm lịch sử Homo sapiens từ săn bắn đến kỷ nguyên số. Homo Deus: Lược sử tương lai — dự đoán số phận nhân loại khi đối mặt với AI và công nghệ sinh học. Bản tiếng Việt Nhã Nam xuất bản, dịch giả Nguyễn Thủy Chung. Bìa cứng sang trọng, 524 + 506 trang. Giấy couche in 4 màu. Box set giá trị.',
          price: 489000, original: 649000, featured: 1, shop: 2
        },
        {
          name: 'Đắc Nhân Tâm — Dale Carnegie (Bìa cứng)',
          img: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
          short: 'Nghệ thuật ứng xử huyền thoại, bản bìa cứng sưu tầm.',
          desc: 'Đắc Nhân Tâm — How to Win Friends and Influence People của Dale Carnegie đã bán 30 triệu bản toàn cầu từ 1936. Sách dạy 6 nguyên tắc khiến người khác yêu thích, 12 cách thuyết phục, 9 cách thay đổi người khác mà không gây phẫn nộ. Ví dụ thực tế từ Lincoln, Edison, Rockefeller. Bản tiếng Việt First News dịch lại toàn bộ, không lược. Bìa cứng vải bọc da, in vàng nhũ, box bảo vệ. 352 trang giấy Ford trắng. Quà tặng sang trọng.',
          price: 289000, original: 369000, featured: 0, shop: 2
        },
        {
          name: 'Rich Dad Poor Dad — Robert Kiyosaki (TV)',
          img: 'https://images.unsplash.com/photo-1589998059171-988d887df646?auto=format&fit=crop&w=800&q=80',
          short: 'Cha giàu cha nghèo, dạy tư duy tài chính cá nhân.',
          desc: 'Rich Dad Poor Dad — cuốn sách đã thay đổi tư duy tài chính của hàng triệu người. Robert Kiyosaki kể câu chuyện về 2 người cha: cha ruột (giáo sư nghèo) và cha của bạn thân (doanh nhân giàu). Sách dạy sự khác biệt giữa tài sản và nợ, tại sao người giàu không làm thuê, tầm quan trọng của giáo dục tài chính. Bản tiếng Việt Thái Hà Books phát hành. 300 trang bìa mềm. Infographic minh họa. Phù hợp người bắt đầu tìm hiểu quản lý tiền bạc và đầu tư.',
          price: 149000, original: 199000, featured: 0, shop: 2
        },
        {
          name: 'Dune — Frank Herbert (Deluxe Edition English)',
          img: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&w=800&q=80',
          short: 'Kiệt tác khoa học viễn tưởng, bìa cứng Penguin Galaxy.',
          desc: 'Dune của Frank Herbert — kiệt tác science fiction được Frank Herbert xuất bản 1965, đoạt giải Hugo và Nebula. Câu chuyện của Paul Atreides trên hành tinh sa mạc Arrakis — nơi có "spice" melange quý giá kéo dài tuổi thọ. Cốt truyện kết hợp chính trị, tôn giáo, sinh thái, AI, chủ nghĩa anh hùng. Cảm hứng cho phim Dune 2021/2024. Bản Penguin Galaxy bìa cứng sưu tầm, gáy vải, box slipcase. Nguyên bản tiếng Anh 896 trang. Lý tưởng cho bộ sưu tập sách sci-fi.',
          price: 590000, original: 790000, featured: 0, shop: 2
        },
        {
          name: 'Bộ sách Harry Potter 7 tập — J.K. Rowling (TV)',
          img: 'https://images.unsplash.com/photo-1609866138210-84bb689f3c6a?auto=format&fit=crop&w=800&q=80',
          short: 'Trọn bộ 7 tập bản NXB Trẻ tiếng Việt, bìa mới 2021.',
          desc: 'Bộ Harry Potter trọn 7 tập bản NXB Trẻ tiếng Việt, bìa 2021 được minh họa lại bởi nghệ sĩ người Việt. Bao gồm: Hòn đá Phù thủy, Phòng chứa bí mật, Tên tù nhân ngục Azkaban, Chiếc cốc lửa, Hội Phượng Hoàng, Hoàng tử lai, Bảo bối Tử thần. Dịch giả Lý Lan. Tổng 4200 trang giấy Ford trắng, bìa mềm. Kho tàng tuổi thơ của hàng triệu độc giả Việt. Box set có dây đeo — tiện lợi di chuyển hoặc trưng bày tủ sách.',
          price: 1290000, original: 1590000, featured: 1, shop: 2
        },
        {
          name: 'Nhà Giả Kim — Paulo Coelho',
          img: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
          short: 'Hành trình tìm kiếm giấc mơ, bestseller 65 triệu bản.',
          desc: 'Nhà Giả Kim (The Alchemist) của Paulo Coelho — cuốn tiểu thuyết đã bán 65 triệu bản, được dịch sang 80 ngôn ngữ. Câu chuyện cậu bé chăn cừu Santiago hành trình từ Tây Ban Nha đến Ai Cập tìm kho báu và khám phá "Huyền Thoại Cá Nhân" của mình. Tác phẩm đầy ẩn dụ về số phận, giấc mơ, và vũ trụ luôn ủng hộ người dám mơ. Bản tiếng Việt Nhã Nam, dịch giả Lê Chu Cầu. 228 trang, bìa mềm giấy dày. Tặng kèm bookmark.',
          price: 119000, original: 159000, featured: 0, shop: 2
        },
        {
          name: 'Sổ tay Moleskine Classic Large Ruled',
          img: 'https://images.unsplash.com/photo-1527168027773-0cc890c4f42e?auto=format&fit=crop&w=800&q=80',
          short: 'Bìa da PU, 240 trang acid-free, băng thun đen.',
          desc: 'Sổ Moleskine Classic Large Ruled — biểu tượng văn phòng phẩm từ Ý. Bìa da PU chất lượng cao, bo góc mềm cầm thoải mái. 240 trang giấy ivory 70gsm acid-free, kẻ ngang mờ dịu mắt — viết bút bi, bút máy, màu nước đều đẹp, không thấm sang trang sau. Băng thun giữ bìa. Túi phía sau đựng danh thiếp, ticket. Dây đánh dấu dải. Kích thước Large 13x21cm vừa túi xách. Được Picasso, Hemingway, Bruce Chatwin sử dụng. Hộp cellophane seal.',
          price: 490000, original: 690000, featured: 0, shop: 2
        },
        {
          name: 'Bút máy Lamy Safari Fountain Pen',
          img: 'https://images.unsplash.com/photo-1550985543-49bee3167284?auto=format&fit=crop&w=800&q=80',
          short: 'Thiết kế Bauhaus, ngòi thép M, nhập Đức.',
          desc: 'Bút máy Lamy Safari do Lamy Đức sản xuất từ 1980, được ưa chuộng bởi sinh viên, nhà thiết kế, kiến trúc sư. Thân ABS polycarbonate cứng cáp, kẹp bút inox bung linh hoạt. Thiết kế Bauhaus tối giản, cầm tay 3 cạnh tam giác giúp định vị ngón cầm đúng cách. Ngòi thép không gỉ thay được (F/M/B/EF). Nạp mực bằng cartridge T10 hoặc converter Z28 (mua riêng). 15+ màu vui nhộn: Yellow, Red, White, All Black, Pink. Tặng hộp carton Lamy và mực cartridge.',
          price: 790000, original: 990000, featured: 0, shop: 2
        },
        {
          name: 'Máy tính Casio FX-580VN X Plus (CASIO Việt Nam)',
          img: 'https://images.unsplash.com/photo-1574607383476-f517f260d30b?auto=format&fit=crop&w=800&q=80',
          short: 'Máy tính học sinh, 552 chức năng, chuẩn thi Bộ GD-ĐT.',
          desc: 'Máy tính khoa học Casio FX-580VN X Plus được Bộ Giáo dục Việt Nam cho phép sử dụng trong kỳ thi THPT Quốc gia. 552 tính năng toán học nâng cao: giải phương trình bậc 4, ma trận, vector, tích phân, đạo hàm, xác suất thống kê, biểu đồ QR code tra cứu. Màn hình Natural V.P.A.M hiển thị đúng như sách giáo khoa. Pin AA + năng lượng mặt trời. Vỏ cứng bảo vệ. Bảo hành chính hãng Bitex Việt Nam 5 năm.',
          price: 490000, original: 590000, featured: 0, shop: 2
        }
      ]
    };

    // Flatten catalog into array — keep realistic prices from each product
    const shops = [shop1Id, shop2Id, shop3Id];
    const products = [];
    for (const [cat, items] of Object.entries(curatedProducts)) {
      for (const item of items) {
        products.push({
          name: item.name,
          price: item.price,
          original: item.original,
          cat,
          shop: shops[(item.shop || 1) - 1],
          featured: item.featured || 0,
          img: item.img,
          desc: item.desc,
          short: item.short
        });
      }
    }

    // Generate realistic variants to reach ~120 total
    const targetCount = 120;
    const colors = ['Đen', 'Trắng', 'Bạc', 'Xanh Navy', 'Đỏ', 'Hồng', 'Xám', 'Vàng Gold'];
    const editions = ['Phiên bản 2024', 'Limited Edition', 'Pro Max', 'Lite', 'Plus', 'SE'];

    let attempts = 0;
    while (products.length < targetCount && attempts < 500) {
      attempts++;
      const catKeys = Object.keys(curatedProducts);
      const cat = catKeys[Math.floor(Math.random() * catKeys.length)];
      const items = curatedProducts[cat];
      const baseItem = items[Math.floor(Math.random() * items.length)];

      const isColor = Math.random() > 0.5;
      const suffix = isColor
        ? colors[Math.floor(Math.random() * colors.length)]
        : editions[Math.floor(Math.random() * editions.length)];

      // Price variation ±15% to keep reasonable
      const variance = 0.85 + Math.random() * 0.3;
      const newPrice = Math.round((baseItem.price * variance) / 1000) * 1000;
      const newOriginal = baseItem.original
        ? Math.round((baseItem.original * variance) / 1000) * 1000
        : null;

      products.push({
        name: `${baseItem.name} — ${suffix}`,
        price: newPrice,
        original: newOriginal,
        cat,
        shop: shops[Math.floor(Math.random() * shops.length)],
        featured: Math.random() > 0.92 ? 1 : 0,
        img: baseItem.img,
        desc: baseItem.desc,
        short: baseItem.short
      });
    }

    const insertImage = db.prepare(`
      INSERT INTO product_images (product_id, image_url, is_primary, sort_order) VALUES (?, ?, 1, 0)
    `);
    const allProductIds = [];
    for (const p of products) {
      const result = insertProduct.run(
        p.shop,
        categoryMap[p.cat],
        p.name,
        createSlug(p.name) + '-' + Math.floor(Math.random() * 100000),
        p.desc || `Sản phẩm chất lượng ${p.name}`,
        p.short || `${p.name}`,
        p.price,
        p.original,
        Math.floor(Math.random() * 150) + 20, // stock 20-170 (tránh hết hàng luôn)
        (Math.random() * 1.5 + 3.5).toFixed(1),
        p.featured
      );
      const pid = result.lastInsertRowid;
      const soldQty = Math.floor(Math.random() * 500);
      db.prepare('UPDATE products SET sold_quantity = ? WHERE id = ?').run(soldQty, pid);
      allProductIds.push(pid);
      insertImage.run(pid, p.img);
    }

    const product1Id = allProductIds[0];
    const product6Id = allProductIds[5] || allProductIds[0];
    const product11Id = allProductIds[10] || allProductIds[0];

    console.log('Creating sample orders...');
    const order1Id = db.prepare(`
      INSERT INTO orders (order_number, customer_id, shop_id, status, payment_status, payment_method, subtotal, shipping_fee, discount_amount, total_amount, shipping_address)
      VALUES ('ORD202401001', ?, ?, 'delivered', 'paid', 'cod', 6490000, 30000, 0, 6520000, '{"recipient_name": "Alex Morgan", "phone": "0911111111", "province": "Ho Chi Minh City", "district": "District 1", "ward": "Ben Nghe", "street_address": "123 Nguyen Hue Street"}')
    `).run(customer1Id, shop1Id).lastInsertRowid;
    db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, price, quantity, total) VALUES (?, ?, 'Sony WH-1000XM5 Tai nghe chống ồn', 6490000, 1, 6490000)
    `).run(order1Id, product1Id);
    const insertTracking = db.prepare(`
      INSERT INTO order_tracking (order_id, status, description) VALUES (?, ?, ?)
    `);
    insertTracking.run(order1Id, 'Order Placed', 'Đơn hàng đã được đặt');
    insertTracking.run(order1Id, 'Order Confirmed', 'Người bán đã xác nhận đơn hàng');
    insertTracking.run(order1Id, 'Order Shipped', 'Đơn hàng đang trên đường giao');
    insertTracking.run(order1Id, 'Order Delivered', 'Đơn hàng đã được giao thành công');

    const order2Id = db.prepare(`
      INSERT INTO orders (order_number, customer_id, shop_id, status, payment_status, payment_method, subtotal, shipping_fee, discount_amount, total_amount, shipping_address)
      VALUES ('ORD202401002', ?, ?, 'shipping', 'paid', 'bank_transfer', 2890000, 30000, 100000, 2820000, '{"recipient_name": "Sarah Johnson", "phone": "0922222222", "province": "Ha Noi", "district": "Cau Giay", "ward": "Dich Vong", "street_address": "789 Xuan Thuy Street"}')
    `).run(customer2Id, shop2Id).lastInsertRowid;
    db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, price, quantity, total) VALUES (?, ?, 'Nike Air Force 1 07 White', 2890000, 1, 2890000)
    `).run(order2Id, product6Id);
    insertTracking.run(order2Id, 'Order Placed', 'Đơn hàng đã được đặt');
    insertTracking.run(order2Id, 'Order Confirmed', 'Người bán xác nhận');
    insertTracking.run(order2Id, 'Order Shipped', 'Đơn hàng đang được vận chuyển');

    db.prepare(`
      INSERT INTO orders (order_number, customer_id, shop_id, status, payment_status, payment_method, subtotal, shipping_fee, discount_amount, total_amount, shipping_address)
      VALUES ('ORD202401003', ?, ?, 'pending', 'pending', 'cod', 490000, 30000, 0, 520000, '{"recipient_name": "Mike Wilson", "phone": "0933333333", "province": "Da Nang", "district": "Hai Chau", "ward": "Hai Chau 1", "street_address": "321 Bach Dang Street"}')
    `).run(customer3Id, shop3Id);

    console.log('Creating sample reviews...');
    const insertReview = db.prepare(`
      INSERT INTO reviews (product_id, customer_id, rating, comment, status) VALUES (?, ?, ?, ?, 'approved')
    `);
    insertReview.run(product1Id, customer1Id, 5, 'Tai nghe quá tuyệt, chống ồn cực tốt, pin trâu. Đã dùng 1 tháng rất hài lòng!');
    insertReview.run(product6Id, customer2Id, 5, 'Giày đẹp, đi êm, chất da bền. Giao hàng nhanh, đóng gói cẩn thận.');
    insertReview.run(product11Id, customer3Id, 4, 'Sản phẩm chất lượng, giá hợp lý. Shop tư vấn nhiệt tình.');
    db.prepare('UPDATE products SET total_reviews = 1 WHERE id IN (?, ?, ?)').run(product1Id, product6Id, product11Id);

    console.log('Creating promotions...');
    const promotion1Id = db.prepare(`
      INSERT INTO promotions (shop_id, name, description, type, value, min_order_amount, max_discount_amount, start_date, end_date, created_by)
      VALUES (NULL, 'Khuyến mãi năm mới 2024', 'Giảm 10% cho mọi đơn hàng', 'percentage', 10, 500000, 200000, datetime('now'), datetime('now', '+30 days'), 'admin')
    `).run().lastInsertRowid;
    const promotion2Id = db.prepare(`
      INSERT INTO promotions (shop_id, name, description, type, value, min_order_amount, max_discount_amount, start_date, end_date, created_by)
      VALUES (?, 'Tech Store Flash Sale', 'Giảm 500k cho đơn từ 5 triệu', 'fixed_amount', 500000, 5000000, NULL, datetime('now'), datetime('now', '+15 days'), 'shop')
    `).run(shop1Id).lastInsertRowid;
    const promotion3Id = db.prepare(`
      INSERT INTO promotions (shop_id, name, description, type, value, min_order_amount, max_discount_amount, start_date, end_date, created_by)
      VALUES (?, 'Fashion Friday', 'Giảm 15% tất cả thời trang', 'percentage', 15, 1000000, 500000, datetime('now'), datetime('now', '+7 days'), 'shop')
    `).run(shop2Id).lastInsertRowid;
    const insertCoupon = db.prepare('INSERT INTO coupons (promotion_id, code) VALUES (?, ?)');
    insertCoupon.run(promotion1Id, 'NEWYEAR2024');
    insertCoupon.run(promotion2Id, 'TECH500K');
    insertCoupon.run(promotion3Id, 'FASHION15');

    console.log('Creating sample support ticket...');
    const ticketId = db.prepare(`
      INSERT INTO support_tickets (ticket_number, user_id, subject, category, status, priority)
      VALUES ('TKT00001', ?, 'Thắc mắc về giao hàng', 'shipping', 'open', 'medium')
    `).run(customer1UserId).lastInsertRowid;
    db.prepare(`
      INSERT INTO support_messages (ticket_id, sender_id, message)
      VALUES (?, ?, 'Chào shop, đơn hàng của mình hiển thị đã giao nhưng mình chưa nhận được. Shop kiểm tra giúp mình với.')
    `).run(ticketId, customer1UserId);

    console.log('\n========================================');
    console.log('Seed completed successfully!');
    console.log(`Total products seeded: ${allProductIds.length}`);
    console.log('========================================\n');
    console.log('Test Accounts:');
    console.log('----------------------------------------');
    console.log('Admin:    admin@ecommerce.com / 123456');
    console.log('Shop 1:   techstore@shop.com / 123456');
    console.log('Shop 2:   fashionhub@shop.com / 123456');
    console.log('Shop 3:   beautyworld@shop.com / 123456');
    console.log('Customer: customer1@email.com / 123456');
    console.log('Customer: customer2@email.com / 123456');
    console.log('Customer: customer3@email.com / 123456');
    console.log('----------------------------------------\n');
  } catch (error) {
    console.error('Seed failed:', error);
  } finally {
    db.close();
  }
};

if (require.main === module) {
  seedData();
}

module.exports = seedData;
