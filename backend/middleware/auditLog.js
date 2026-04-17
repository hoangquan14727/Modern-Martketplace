const db = require('../config/database');

const writeAudit = (actor, action, targetType, targetId, payload, req) => {
  try {
    db.prepare(`
      INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, payload, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actor.id,
      actor.role,
      action,
      targetType,
      targetId == null ? null : Number(targetId),
      payload == null ? null : JSON.stringify(payload),
      req && req.ip ? req.ip : null,
      req && req.get ? (req.get('user-agent') || null) : null
    );
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
};

const auditAction = (action, targetType) => (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 400 && req.user) {
      const targetId = req.params.id || (body && body.data && body.data.id) || null;
      writeAudit(req.user, action, targetType, targetId, { params: req.params, body: req.body }, req);
    }
    return originalJson(body);
  };
  next();
};

module.exports = { writeAudit, auditAction };
