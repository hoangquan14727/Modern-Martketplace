const { pool } = require('../config/database');
const { paginate, paginateResponse, generateTicketNumber } = require('../utils/helpers');

// HTML sanitization helper — defense-in-depth alongside frontend escaping
const sanitizeHtml = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const createTicket = async (req, res) => {
  try {
    const { subject, category, message, attachments, shopId, orderId, productId, productName } = req.body;
    const ticketNumber = generateTicketNumber();

    // Incorporate product context into subject if provided
    let finalSubject = subject;
    if (productId && productName) {
      finalSubject = `${subject} [Product: ${sanitizeHtml(productName)} (#${productId})]`;
    } else if (productName) {
      finalSubject = `${subject} [Product: ${sanitizeHtml(productName)}]`;
    }

    const sanitizedMessage = sanitizeHtml(message);

    const [result] = await pool.query(
      `INSERT INTO support_tickets (ticket_number, user_id, shop_id, order_id, subject, category, last_activity_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [ticketNumber, req.user.id, shopId || null, orderId || null, finalSubject, category]
    );
    const ticketId = result.insertId;
    await pool.query(
      `INSERT INTO support_messages (ticket_id, sender_id, message, attachments)
       VALUES (?, ?, ?, ?)`,
      [ticketId, req.user.id, sanitizedMessage, attachments ? JSON.stringify(attachments) : null]
    );
    let autoReply = null;
    if (shopId) {
      // Get shop owner's user_id so auto-reply appears as from the shop
      const [shopRows] = await pool.query('SELECT user_id FROM shops WHERE id = ?', [shopId]);
      const shopSenderId = shopRows.length > 0 ? shopRows[0].user_id : req.user.id;

      const [cannedResponses] = await pool.query(
        `SELECT * FROM canned_responses WHERE shop_id = ? AND category = ? AND is_active = 1 ORDER BY sort_order`,
        [shopId, category]
      );
      if (cannedResponses.length > 0) {
        const optionsText = cannedResponses.map((cr, i) => `${i + 1}. ${cr.title}`).join('\n');
        autoReply = `Cảm ơn bạn đã liên hệ! Dưới đây là một số hỗ trợ có thể giúp bạn:\n\n${optionsText}\n\nHoặc chọn "Liên hệ trực tiếp" để được nhân viên hỗ trợ.`;
        await pool.query(
          `INSERT INTO support_messages (ticket_id, sender_id, message, is_system)
           VALUES (?, ?, ?, 1)`,
          [ticketId, shopSenderId, autoReply]
        );
      } else {
        autoReply = 'Cảm ơn bạn đã liên hệ! Nhân viên hỗ trợ sẽ phản hồi bạn trong thời gian sớm nhất.';
        await pool.query(
          `INSERT INTO support_messages (ticket_id, sender_id, message, is_system)
           VALUES (?, ?, ?, 1)`,
          [ticketId, shopSenderId, autoReply]
        );
      }
    }
    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully.',
      data: { id: ticketId, ticket_number: ticketNumber, autoReply }
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to create ticket.' });
  }
};
const getUserTickets = async (req, res) => {
  try {
    const { page, limit, status, search, shopId } = req.query;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = 'WHERE t.user_id = ?';
    const params = [req.user.id];
    if (shopId) {
      whereClause += ' AND t.shop_id = ?';
      params.push(parseInt(shopId, 10));
    }
    if (status && status !== 'all') {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }
    if (search) {
      whereClause += ' AND (t.subject LIKE ? OR t.ticket_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM support_tickets t ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [tickets] = await pool.query(
      `SELECT t.*,
        s.shop_name,
        (SELECT COUNT(*) FROM support_messages WHERE ticket_id = t.id) as message_count,
        (SELECT message FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message_at
       FROM support_tickets t
       LEFT JOIN shops s ON t.shop_id = s.id
       ${whereClause}
       ORDER BY t.last_activity_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({ success: true, ...paginateResponse(tickets, total, pageNum, limitNum) });
  } catch (error) {
    console.error('Get user tickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to get tickets.' });
  }
};
const getTicket = async (req, res) => {
  try {
    const { id } = req.params;
    let whereClause = 'WHERE (t.id = ? OR t.ticket_number = ?)';
    const params = [id, id];
    if (req.user.role === 'shop') {
      const [shops] = await pool.query('SELECT id FROM shops WHERE user_id = ?', [req.user.id]);
      if (shops.length > 0) {
        whereClause += ' AND (t.user_id = ? OR t.shop_id = ?)';
        params.push(req.user.id, shops[0].id);
      }
    } else if (req.user.role !== 'admin') {
      whereClause += ' AND t.user_id = ?';
      params.push(req.user.id);
    }
    const [tickets] = await pool.query(
      `SELECT t.*,
        u.email as user_email,
        s.shop_name,
        o.order_number,
        CASE
          WHEN u.role = 'customer' THEN (SELECT (first_name || ' ' || last_name) FROM customers WHERE user_id = u.id)
          WHEN u.role = 'shop' THEN (SELECT shop_name FROM shops WHERE user_id = u.id)
          ELSE 'Admin'
        END as user_name
       FROM support_tickets t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN shops s ON t.shop_id = s.id
       LEFT JOIN orders o ON t.order_id = o.id
       ${whereClause}`,
      params
    );
    if (tickets.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }
    const ticket = tickets[0];
    const [messages] = await pool.query(
      `SELECT m.*, m.read_at,
        u.role as sender_role,
        CASE
          WHEN u.role = 'customer' THEN (SELECT (first_name || ' ' || last_name) FROM customers WHERE user_id = u.id)
          WHEN u.role = 'shop' THEN (SELECT shop_name FROM shops WHERE user_id = u.id)
          WHEN u.role = 'admin' THEN (SELECT (first_name || ' ' || last_name) FROM admins WHERE user_id = u.id)
        END as sender_name
       FROM support_messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.ticket_id = ?
       ORDER BY m.created_at ASC`,
      [ticket.id]
    );
    res.json({ success: true, data: { ...ticket, messages } });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to get ticket.' });
  }
};
const addMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message: rawMessage, attachments } = req.body;

    // Sanitize message content — defense-in-depth against XSS
    const message = sanitizeHtml(rawMessage || '');
    if (!message && !attachments) {
      return res.status(400).json({ success: false, message: 'Message or attachment is required.' });
    }

    let whereClause = 'WHERE id = ?';
    const params = [id];
    if (req.user.role === 'shop') {
      const [shops] = await pool.query('SELECT id FROM shops WHERE user_id = ?', [req.user.id]);
      if (shops.length > 0) {
        whereClause += ' AND (user_id = ? OR shop_id = ?)';
        params.push(req.user.id, shops[0].id);
      }
    } else if (req.user.role !== 'admin') {
      whereClause += ' AND user_id = ?';
      params.push(req.user.id);
    }
    const [tickets] = await pool.query(`SELECT * FROM support_tickets ${whereClause}`, params);
    if (tickets.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }
    const ticket = tickets[0];
    if (['resolved', 'closed'].includes(ticket.status)) {
      return res.status(400).json({ success: false, message: 'Cannot add message to closed ticket.' });
    }
    await pool.query(
      `INSERT INTO support_messages (ticket_id, sender_id, message, attachments)
       VALUES (?, ?, ?, ?)`,
      [id, req.user.id, message, attachments ? JSON.stringify(attachments) : null]
    );
    let newStatus = ticket.status;
    if (req.user.role === 'admin' || req.user.role === 'shop') {
      newStatus = 'waiting_customer';
    } else if (ticket.status === 'waiting_customer' || ticket.status === 'open') {
      newStatus = 'waiting_shop';
    }
    await pool.query(
      `UPDATE support_tickets SET status = ?, last_activity_at = datetime('now'), auto_close_warned = 0 WHERE id = ?`,
      [newStatus, id]
    );
    res.status(201).json({ success: true, message: 'Message added successfully.' });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({ success: false, message: 'Failed to add message.' });
  }
};
const pollMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { after } = req.query;

    // Verify the user has access to this ticket (same permission logic as getTicket)
    let whereClause = 'WHERE (t.id = ? OR t.ticket_number = ?)';
    const params = [id, id];
    if (req.user.role === 'shop') {
      const [shops] = await pool.query('SELECT id FROM shops WHERE user_id = ?', [req.user.id]);
      if (shops.length > 0) {
        whereClause += ' AND (t.user_id = ? OR t.shop_id = ?)';
        params.push(req.user.id, shops[0].id);
      }
    } else if (req.user.role !== 'admin') {
      whereClause += ' AND t.user_id = ?';
      params.push(req.user.id);
    }

    const [tickets] = await pool.query(
      `SELECT t.id FROM support_tickets t ${whereClause}`,
      params
    );
    if (tickets.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const ticketId = tickets[0].id;

    // Build the messages query — only return messages after the given timestamp
    let msgQuery = `SELECT m.id, m.ticket_id, m.sender_id, m.message, m.attachments, m.is_system, m.read_at, m.created_at,
        u.role as sender_role,
        CASE
          WHEN u.role = 'customer' THEN (SELECT (first_name || ' ' || last_name) FROM customers WHERE user_id = u.id)
          WHEN u.role = 'shop' THEN (SELECT shop_name FROM shops WHERE user_id = u.id)
          WHEN u.role = 'admin' THEN (SELECT (first_name || ' ' || last_name) FROM admins WHERE user_id = u.id)
        END as sender_name
       FROM support_messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.ticket_id = ?`;
    const msgParams = [ticketId];

    if (after) {
      msgQuery += ' AND m.created_at > ?';
      msgParams.push(after);
    }

    msgQuery += ' ORDER BY m.created_at ASC';

    const [messages] = await pool.query(msgQuery, msgParams);

    res.json({ success: true, messages });
  } catch (error) {
    console.error('Poll messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to poll messages.' });
  }
};

const closeTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(
      `UPDATE support_tickets SET status = 'closed', resolved_at = datetime('now')
       WHERE id = ? AND user_id = ? AND status NOT IN ('closed')`,
      [id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found or already closed.' });
    }
    res.json({ success: true, message: 'Ticket closed.' });
  } catch (error) {
    console.error('Close ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to close ticket.' });
  }
};
const rateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const [result] = await pool.query(
      `UPDATE support_tickets SET rating = ?, rating_comment = ?
       WHERE id = ? AND user_id = ? AND status IN ('resolved', 'closed')`,
      [rating, comment || null, id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found or not closed.' });
    }
    res.json({ success: true, message: 'Rating submitted.' });
  } catch (error) {
    console.error('Rate ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to rate ticket.' });
  }
};
const getTypingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const [status] = await pool.query(
      `SELECT ts.*, u.role as user_role,
        CASE
          WHEN u.role = 'customer' THEN (SELECT (first_name || ' ' || last_name) FROM customers WHERE user_id = u.id)
          WHEN u.role = 'shop' THEN (SELECT shop_name FROM shops WHERE user_id = u.id)
          WHEN u.role = 'admin' THEN 'Support Agent'
        END as user_name
       FROM typing_status ts
       JOIN users u ON ts.user_id = u.id
       WHERE ts.ticket_id = ? AND ts.user_id != ? AND ts.is_typing = 1
       AND datetime(ts.updated_at, '+10 seconds') > datetime('now')`,
      [id, req.user.id]
    );
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Get typing status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get typing status.' });
  }
};
const setTypingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isTyping } = req.body;
    await pool.query(
      `INSERT INTO typing_status (ticket_id, user_id, is_typing, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(ticket_id, user_id) DO UPDATE SET is_typing = ?, updated_at = datetime('now')`,
      [id, req.user.id, isTyping ? 1 : 0, isTyping ? 1 : 0]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Set typing status error:', error);
    res.status(500).json({ success: false, message: 'Failed to set typing status.' });
  }
};
const getShopTickets = async (req, res) => {
  try {
    const { page, limit, status, search } = req.query;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    const [shops] = await pool.query('SELECT id FROM shops WHERE user_id = ?', [req.user.id]);
    if (shops.length === 0) {
      return res.status(404).json({ success: false, message: 'Shop not found.' });
    }
    const shopId = shops[0].id;
    let whereClause = 'WHERE t.shop_id = ?';
    const params = [shopId];
    if (status && status !== 'all') {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }
    if (search) {
      whereClause += ' AND (t.subject LIKE ? OR t.ticket_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM support_tickets t ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [tickets] = await pool.query(
      `SELECT t.*,
        u.email as user_email,
        CASE
          WHEN u.role = 'customer' THEN (SELECT (first_name || ' ' || last_name) FROM customers WHERE user_id = u.id)
        END as user_name,
        (SELECT message FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM support_tickets t
       JOIN users u ON t.user_id = u.id
       ${whereClause}
       ORDER BY t.last_activity_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({ success: true, ...paginateResponse(tickets, total, pageNum, limitNum) });
  } catch (error) {
    console.error('Get shop tickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to get tickets.' });
  }
};
const getCannedResponses = async (req, res) => {
  try {
    const [shops] = await pool.query('SELECT id FROM shops WHERE user_id = ?', [req.user.id]);
    if (shops.length === 0) {
      return res.status(404).json({ success: false, message: 'Shop not found.' });
    }
    const [responses] = await pool.query(
      'SELECT * FROM canned_responses WHERE shop_id = ? ORDER BY category, sort_order',
      [shops[0].id]
    );
    res.json({ success: true, data: responses });
  } catch (error) {
    console.error('Get canned responses error:', error);
    res.status(500).json({ success: false, message: 'Failed to get canned responses.' });
  }
};
const createCannedResponse = async (req, res) => {
  try {
    const { category, title, response } = req.body;
    const [shops] = await pool.query('SELECT id FROM shops WHERE user_id = ?', [req.user.id]);
    if (shops.length === 0) {
      return res.status(404).json({ success: false, message: 'Shop not found.' });
    }
    const [result] = await pool.query(
      `INSERT INTO canned_responses (shop_id, category, title, response)
       VALUES (?, ?, ?, ?)`,
      [shops[0].id, category, title, response]
    );
    res.status(201).json({ success: true, message: 'Canned response created.', data: { id: result.insertId } });
  } catch (error) {
    console.error('Create canned response error:', error);
    res.status(500).json({ success: false, message: 'Failed to create canned response.' });
  }
};
const updateCannedResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, title, response, isActive, sortOrder } = req.body;
    const [shops] = await pool.query('SELECT id FROM shops WHERE user_id = ?', [req.user.id]);
    if (shops.length === 0) {
      return res.status(404).json({ success: false, message: 'Shop not found.' });
    }
    const updates = [];
    const params = [];
    if (category) { updates.push('category = ?'); params.push(category); }
    if (title) { updates.push('title = ?'); params.push(title); }
    if (response) { updates.push('response = ?'); params.push(response); }
    if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }
    if (sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(sortOrder); }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }
    params.push(id, shops[0].id);
    const [result] = await pool.query(
      `UPDATE canned_responses SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ? AND shop_id = ?`,
      params
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Canned response not found.' });
    }
    res.json({ success: true, message: 'Canned response updated.' });
  } catch (error) {
    console.error('Update canned response error:', error);
    res.status(500).json({ success: false, message: 'Failed to update canned response.' });
  }
};
const deleteCannedResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const [shops] = await pool.query('SELECT id FROM shops WHERE user_id = ?', [req.user.id]);
    if (shops.length === 0) {
      return res.status(404).json({ success: false, message: 'Shop not found.' });
    }
    const [result] = await pool.query(
      'DELETE FROM canned_responses WHERE id = ? AND shop_id = ?',
      [id, shops[0].id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Canned response not found.' });
    }
    res.json({ success: true, message: 'Canned response deleted.' });
  } catch (error) {
    console.error('Delete canned response error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete canned response.' });
  }
};
const getShopCannedResponses = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { category } = req.query;
    let query = 'SELECT id, category, title, response FROM canned_responses WHERE shop_id = ? AND is_active = 1';
    const params = [shopId];
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    query += ' ORDER BY sort_order';
    const [responses] = await pool.query(query, params);
    res.json({ success: true, data: responses });
  } catch (error) {
    console.error('Get shop canned responses error:', error);
    res.status(500).json({ success: false, message: 'Failed to get canned responses.' });
  }
};
const getAllTickets = async (req, res) => {
  try {
    const { page, limit, status, category, priority, shopId, search } = req.query;
    const { page: pageNum, limit: limitNum, offset } = paginate(page, limit);
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (status && status !== 'all') { whereClause += ' AND t.status = ?'; params.push(status); }
    if (category) { whereClause += ' AND t.category = ?'; params.push(category); }
    if (priority) { whereClause += ' AND t.priority = ?'; params.push(priority); }
    if (shopId) { whereClause += ' AND t.shop_id = ?'; params.push(shopId); }
    if (search) {
      whereClause += ' AND (t.subject LIKE ? OR t.ticket_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM support_tickets t ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    const [tickets] = await pool.query(
      `SELECT t.*,
        u.email as user_email,
        s.shop_name,
        CASE
          WHEN u.role = 'customer' THEN (SELECT (first_name || ' ' || last_name) FROM customers WHERE user_id = u.id)
          WHEN u.role = 'shop' THEN (SELECT shop_name FROM shops WHERE user_id = u.id)
        END as user_name
       FROM support_tickets t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN shops s ON t.shop_id = s.id
       ${whereClause}
       ORDER BY
         CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         t.last_activity_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );
    res.json({ success: true, ...paginateResponse(tickets, total, pageNum, limitNum) });
  } catch (error) {
    console.error('Get all tickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to get tickets.' });
  }
};
const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, assignedTo } = req.body;
    const updates = [];
    const params = [];
    if (status) {
      updates.push('status = ?');
      params.push(status);
      if (status === 'resolved') {
        updates.push("resolved_at = datetime('now')");
      }
    }
    if (priority) { updates.push('priority = ?'); params.push(priority); }
    if (assignedTo !== undefined) { updates.push('assigned_to = ?'); params.push(assignedTo || null); }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }
    params.push(id);
    const [result] = await pool.query(
      `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }
    res.json({ success: true, message: 'Ticket updated.' });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to update ticket.' });
  }
};
const getSupportStats = async (req, res) => {
  try {
    const [stats] = await pool.query(
      `SELECT
        COUNT(*) as total_tickets,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_tickets,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tickets,
        SUM(CASE WHEN status IN ('waiting_customer', 'waiting_shop') THEN 1 ELSE 0 END) as waiting_tickets,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_tickets,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_tickets,
        SUM(CASE WHEN priority = 'urgent' AND status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END) as urgent_tickets,
        AVG(rating) as avg_rating
       FROM support_tickets`
    );
    res.json({ success: true, data: stats[0] });
  } catch (error) {
    console.error('Get support stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get stats.' });
  }
};
const checkAutoClose = async (req, res) => {
  try {
    const [ticketsToWarn] = await pool.query(
      `SELECT id FROM support_tickets 
       WHERE status NOT IN ('resolved', 'closed') 
       AND auto_close_warned = 0
       AND datetime(last_activity_at, '+3 days') < datetime('now')`
    );
    for (const ticket of ticketsToWarn) {
      await pool.query(
        `INSERT INTO support_messages (ticket_id, sender_id, message, is_system)
         VALUES (?, 1, '⚠️ Ticket này sẽ tự động đóng sau 24 giờ nếu không có phản hồi.', 1)`,
        [ticket.id]
      );
      await pool.query('UPDATE support_tickets SET auto_close_warned = 1 WHERE id = ?', [ticket.id]);
    }
    const [ticketsToClose] = await pool.query(
      `SELECT id FROM support_tickets 
       WHERE status NOT IN ('resolved', 'closed') 
       AND auto_close_warned = 1
       AND datetime(last_activity_at, '+4 days') < datetime('now')`
    );
    for (const ticket of ticketsToClose) {
      await pool.query(
        `INSERT INTO support_messages (ticket_id, sender_id, message, is_system)
         VALUES (?, 1, 'Ticket đã tự động đóng do không có phản hồi.', 1)`,
        [ticket.id]
      );
      await pool.query(
        `UPDATE support_tickets SET status = 'closed', resolved_at = datetime('now') WHERE id = ?`,
        [ticket.id]
      );
    }
    res.json({
      success: true,
      message: `Warned ${ticketsToWarn.length} tickets, closed ${ticketsToClose.length} tickets.`
    });
  } catch (error) {
    console.error('Check auto-close error:', error);
    res.status(500).json({ success: false, message: 'Failed to check auto-close.' });
  }
};
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify user has access to this ticket (same permission pattern as getTicket)
    let whereClause = 'WHERE (t.id = ? OR t.ticket_number = ?)';
    const params = [id, id];
    if (req.user.role === 'shop') {
      const [shops] = await pool.query('SELECT id FROM shops WHERE user_id = ?', [req.user.id]);
      if (shops.length > 0) {
        whereClause += ' AND (t.user_id = ? OR t.shop_id = ?)';
        params.push(req.user.id, shops[0].id);
      }
    } else if (req.user.role !== 'admin') {
      whereClause += ' AND t.user_id = ?';
      params.push(req.user.id);
    }

    const [tickets] = await pool.query(
      `SELECT t.id FROM support_tickets t ${whereClause}`,
      params
    );
    if (tickets.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const ticketId = tickets[0].id;

    // Mark all messages from OTHER users as read
    await pool.query(
      `UPDATE support_messages SET read_at = datetime('now') WHERE ticket_id = ? AND sender_id != ? AND read_at IS NULL`,
      [ticketId, req.user.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark messages as read.' });
  }
};

const getReadStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify user has access to this ticket (same permission pattern as getTicket)
    let whereClause = 'WHERE (t.id = ? OR t.ticket_number = ?)';
    const params = [id, id];
    if (req.user.role === 'shop') {
      const [shops] = await pool.query('SELECT id FROM shops WHERE user_id = ?', [req.user.id]);
      if (shops.length > 0) {
        whereClause += ' AND (t.user_id = ? OR t.shop_id = ?)';
        params.push(req.user.id, shops[0].id);
      }
    } else if (req.user.role !== 'admin') {
      whereClause += ' AND t.user_id = ?';
      params.push(req.user.id);
    }

    const [tickets] = await pool.query(
      `SELECT t.id FROM support_tickets t ${whereClause}`,
      params
    );
    if (tickets.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const ticketId = tickets[0].id;

    // Find when the OTHER person last read MY messages
    const [result] = await pool.query(
      `SELECT MAX(read_at) as lastReadAt FROM support_messages WHERE ticket_id = ? AND sender_id = ? AND read_at IS NOT NULL`,
      [ticketId, req.user.id]
    );

    res.json({ success: true, lastReadAt: result[0].lastReadAt || null });
  } catch (error) {
    console.error('Get read status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get read status.' });
  }
};

module.exports = {
  createTicket,
  getUserTickets,
  getTicket,
  addMessage,
  pollMessages,
  closeTicket,
  rateTicket,
  getTypingStatus,
  setTypingStatus,
  getShopTickets,
  getCannedResponses,
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
  getShopCannedResponses,
  getAllTickets,
  updateTicket,
  getSupportStats,
  checkAutoClose,
  markAsRead,
  getReadStatus
};
