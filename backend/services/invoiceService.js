const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
class InvoiceService {
  static async generateInvoicePDF(order, customer, items) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      try {
        doc.fontSize(24).font('Helvetica-Bold').text('MARIQ', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text('E-Commerce Platform', { align: 'center' });
        doc.fontSize(9).fillColor('#666').text('www.mariq.com | support@mariq.com', { align: 'center' });
        doc.moveTo(40, doc.y + 5).lineTo(555, doc.y + 5).stroke('#ddd');
        doc.moveDown(1);
        doc.fontSize(14).fillColor('#000').font('Helvetica-Bold').text('INVOICE');
        const detailsY = doc.y;
        doc.fontSize(10).font('Helvetica');
        doc.text(`Invoice #: ${order.id || 'N/A'}`, 40, detailsY);
        doc.text(`Date: ${this.formatDate(order.created_at)}`, 40, doc.y);
        doc.text(`Status: ${this.formatStatus(order.status)}`, 40, doc.y);
        doc.fontSize(10).font('Helvetica-Bold').text('BILL TO:', 340, detailsY);
        doc.fontSize(10).font('Helvetica');
        doc.text(
          `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
          340,
          doc.y - 10
        );
        doc.text(`Email: ${customer.email || 'N/A'}`, 340, doc.y);
        doc.text(`Phone: ${customer.phone || 'N/A'}`, 340, doc.y);
        doc.moveDown(1);
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#ddd');
        doc.moveDown(0.5);
        const tableTop = doc.y;
        const col1 = 40;
        const col2 = 250;
        const col3 = 380;
        const col4 = 470;
        const col5 = 540;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000');
        doc.text('Item', col1, tableTop);
        doc.text('Qty', col3, tableTop);
        doc.text('Unit Price', col4, tableTop);
        doc.text('Total', col5, tableTop);
        doc.moveTo(40, doc.y + 5).lineTo(555, doc.y + 5).stroke('#ddd');
        doc.moveDown(0.5);
        doc.fontSize(9).font('Helvetica').fillColor('#000');
        let itemY = doc.y;
        items.forEach((item) => {
          const productName = item.product_name || item.name || 'Unknown Product';
          const quantity = item.quantity || 1;
          const unitPrice = parseFloat(item.price || 0);
          const totalPrice = unitPrice * quantity;
          const maxWidth = 190;
          const lines = doc.widthOfString(productName) > maxWidth
            ? this.wrapText(productName, doc, maxWidth)
            : [productName];
          doc.text(lines[0], col1, itemY);
          for (let i = 1; i < lines.length; i++) {
            itemY += 15;
            doc.text(lines[i], col1, itemY);
          }
          doc.text(quantity.toString(), col3, itemY);
          doc.text(`$${unitPrice.toFixed(2)}`, col4, itemY, { align: 'right' });
          doc.text(`$${totalPrice.toFixed(2)}`, col5, itemY, { align: 'right' });
          itemY += 15;
        });
        doc.moveTo(40, itemY).lineTo(555, itemY).stroke('#ddd');
        doc.moveDown(0.5);
        const subtotal = parseFloat(order.subtotal || order.total || 0);
        const shippingCost = parseFloat(order.shipping_cost || 0);
        const discount = parseFloat(order.discount_amount || 0);
        const total = parseFloat(order.total || 0);
        doc.fontSize(10).font('Helvetica');
        itemY = doc.y;
        const totalsLabel = 450;
        const totalsValue = 540;
        doc.text('Subtotal:', totalsLabel, itemY);
        doc.text(`$${subtotal.toFixed(2)}`, totalsValue, itemY, { align: 'right' });
        doc.moveDown();
        if (shippingCost > 0) {
          doc.text('Shipping:', totalsLabel, doc.y);
          doc.text(`$${shippingCost.toFixed(2)}`, totalsValue, doc.y, { align: 'right' });
          doc.moveDown();
        }
        if (discount > 0) {
          doc.font('Helvetica').fillColor('#27ae60');
          doc.text('Discount:', totalsLabel, doc.y);
          doc.text(`-$${discount.toFixed(2)}`, totalsValue, doc.y, { align: 'right' });
          doc.moveDown();
          doc.fillColor('#000');
        }
        doc.font('Helvetica-Bold').fontSize(11);
        doc.text('TOTAL:', totalsLabel, doc.y);
        doc.text(`$${total.toFixed(2)}`, totalsValue, doc.y, { align: 'right' });
        doc.moveTo(40, doc.y + 10).lineTo(555, doc.y + 10).stroke('#ddd');
        doc.moveDown(1);
        doc.fontSize(9).font('Helvetica').fillColor('#666');
        doc.text('Thank you for your purchase! For support, contact support@mariq.com', {
          align: 'center',
        });
        doc.text('This is an auto-generated invoice. Please keep it for your records.', {
          align: 'center',
        });
        doc.end();
      } catch (error) {
        doc.end();
        reject(error);
      }
    });
  }
  static formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  static formatStatus(status) {
    if (!status) return 'Unknown';
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  static wrapText(text, doc, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    words.forEach((word) => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const width = doc.widthOfString(testLine);
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) lines.push(currentLine);
    return lines;
  }
}
module.exports = InvoiceService;
