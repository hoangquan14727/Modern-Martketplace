const CONFIG = {
    LOCAL_API: 'http://localhost:5000/api',
    PRODUCTION_API: 'https://modern-martketplace.onrender.com/api' 
};


const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? CONFIG.LOCAL_API
    : CONFIG.PRODUCTION_API;

// XSS prevention helper — escape HTML in user-generated content
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Global cart badge updater — works on any page with #cart-badge
async function updateGlobalCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    try {
        const user = typeof TokenService !== 'undefined' ? TokenService.getUser() : null;
        if (!user || user.role === 'admin') return;
        const res = await CartAPI.getCart();
        let totalQty = 0;
        if (res.success && res.data) {
            const items = res.data.shops
                ? res.data.shops.flatMap(s => s.items)
                : (res.data.items || []);
            totalQty = items.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
        }
        if (totalQty > 0) {
            badge.textContent = totalQty > 99 ? '99+' : totalQty;
            badge.classList.remove('hidden');
            // Pop animation
            badge.style.animation = 'none';
            badge.offsetHeight; // trigger reflow
            badge.style.animation = 'badgePop 0.3s ease-out';
        } else {
            badge.classList.add('hidden');
        }
    } catch(e) { /* silent */ }
}

async function updateGlobalMsgBadge() {
    const badge = document.getElementById('msg-badge');
    if (!badge) return;
    try {
        const user = typeof TokenService !== 'undefined' ? TokenService.getUser() : null;
        if (!user) return;
        const res = await SupportAPI.getUserTickets({limit:50});
        if (!res.success || !res.data) return;
        // Count tickets that have unread messages (last_message_at > last time user read)
        // Simple approach: count tickets where status is waiting_customer (shop replied, user hasn't seen)
        const unread = res.data.filter(t => t.status === 'waiting_customer' || t.status === 'waiting_shop').length;
        if (unread > 0) {
            badge.textContent = unread > 99 ? '99+' : unread;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch(e) { /* silent */ }
}

class AuthAPI {
    static async login(email, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const res = await response.json();
            if (res.success && res.data && res.data.user) {
                TokenService.setToken(res.data.token);
                TokenService.setUser(res.data.user);
                window.location.href = this.getRedirectUrl(res.data.user.role);
            } else if (res.success && (!res.data || !res.data.user)) {
                 console.error("Login successful but no user data received", res);
                 return { success: false, message: "Invalid server response" };
            }
            return res;
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: error.message };
        }
    }

    static async register(email, password, firstName, lastName) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, firstName, lastName })
            });
            const res = await response.json();
            if (res.success && res.data && res.data.user) {
                TokenService.setToken(res.data.token);
                TokenService.setUser(res.data.user);
            }
            return res;
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
    
    static async registerShop(email, password, shopName) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register-shop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, shopName })
            });
            const res = await response.json();
            if (res.success && res.data && res.data.user) {
                TokenService.setToken(res.data.token);
                TokenService.setUser(res.data.user);
            }
            return res;
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async changePassword(currentPassword, newPassword) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify({ currentPassword, newPassword })
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async requestPasswordReset(email) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

     static async verifyResetToken(token) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/verify-reset-token/${token}`);
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async resetPassword(token, newPassword) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TokenService.getToken()}`
        };
    }

    static logout() {
        TokenService.clear();
        window.location.href = '/pages/loginPage.html';
    }

    static getRedirectUrl(role) {
        switch(role) {
            case 'admin': return '/pages/adminPage.html';
            case 'shop': return '/pages/shopPage.html'; 
            default: return '/pages/homePage.html';
        }
    }

    static checkAuth(requiredRole = null) {
        const token = TokenService.getToken();
        if (!token) {
            window.location.href = '/pages/loginPage.html';
            return false;
        }
        
        if (requiredRole) {
            const user = TokenService.getUser();
            if (user.role !== requiredRole) {
                window.location.href = '/pages/homePage.html'; 
                return false;
            }
        }
        return true;
    }
}

class ProductsAPI {
    static async getAllProducts(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        try {
            const response = await fetch(`${API_BASE_URL}/products?${query}`);
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async getProduct(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/products/${id}`);
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
    
    static async getShopProducts(shopId, filters = {}) {
        try {
            const params = { ...filters, shop_id: shopId };
            const query = new URLSearchParams(params).toString();
            
            const response = await fetch(`${API_BASE_URL}/products?${query}`);
            return await response.json();
        } catch (error) {
             return { success: false, message: error.message };
        }
    }

    static async getMyShopProducts(filters = {}) {
        try {
            const query = new URLSearchParams(filters).toString();
            const response = await fetch(`${API_BASE_URL}/products/shop/my-products?${query}`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
             return { success: false, message: error.message };
        }
    }

    static async createProduct(productData) {
        try {
            const response = await fetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(productData)
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
    
    static async updateProduct(id, productData) {
        try {
            const response = await fetch(`${API_BASE_URL}/products/${id}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(productData)
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async deleteProduct(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/products/${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
    
    static getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TokenService.getToken()}`
        };
    }
    
    static async updateProductStatus(id, status) {
        try {
             const response = await fetch(`${API_BASE_URL}/products/${id}/status`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify({ status })
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }
    
    static async getAllProductsAdmin() {
         try {
            const response = await fetch(`${API_BASE_URL}/products/admin/all`, {
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async uploadProductImage(formData) {
        try {
            const response = await fetch(`${API_BASE_URL}/products/upload-image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${TokenService.getToken()}`
                },
                body: formData
            });
            return await response.json();
        } catch(error) {
             return { success: false, message: error.message };
        }
    }
}

class CartAPI {
    static async getCart() {
        try {
            const user = TokenService.getUser();
            if(!user) return { success: false };
            const response = await fetch(`${API_BASE_URL}/cart`, {
                headers: this.getHeaders()
            });
            
            if (response.status === 401) {
                TokenService.clear();
                window.location.href = 'loginPage.html';
                return { success: false, message: "Session expired" };
            }
            
            const res = await response.json();
            return res;
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async addToCart(productId, quantity = 1) {
        try {
             const user = TokenService.getUser();
             if(!user) throw new Error("User not logged in");
             
            const response = await fetch(`${API_BASE_URL}/cart/items`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ productId, quantity })
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
    
    static async updateCartItem(id, quantity) {
        try {
            const response = await fetch(`${API_BASE_URL}/cart/items/${id}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify({ quantity })
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async removeCartItem(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/cart/items/${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async clearCart() {
        try {
            const response = await fetch(`${API_BASE_URL}/cart`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static getHeaders() {
         return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TokenService.getToken()}`
        };
    }
}

class OrdersAPI {
    static async createOrder(orderData) {
        try {
            const response = await fetch(`${API_BASE_URL}/orders`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(orderData)
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async checkout(orderData) {
        try {
            const response = await fetch(`${API_BASE_URL}/orders/checkout`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(orderData)
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    
    static async getMyOrders() {
        try {
            const response = await fetch(`${API_BASE_URL}/orders/my-orders`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async getAllOrders() { 
        try {
             const response = await fetch(`${API_BASE_URL}/orders`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async getOrder(id) {
         try {
             const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async createOrderDirect(shippingAddress, items) {
        try {
            const response = await fetch(`${API_BASE_URL}/orders/checkout`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ shippingAddress, items })
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async cancelOrder(id) {
        try {
             const response = await fetch(`${API_BASE_URL}/orders/${id}/cancel`, {
                 method: 'POST',
                 headers: this.getHeaders()
             });
             return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async getShopOrders() {
        try {
             const response = await fetch(`${API_BASE_URL}/orders/shop/orders`, {
                 headers: this.getHeaders()
            });
             return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async updateOrderStatus(id, status) {
        try {
             const response = await fetch(`${API_BASE_URL}/orders/${id}/status`, {
                 method: 'PATCH',
                 headers: this.getHeaders(),
                 body: JSON.stringify({ status })
             });
             return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

     static async downloadInvoice(id) {
         try {
             const response = await fetch(`${API_BASE_URL}/orders/${id}/invoice`, {
                headers: this.getHeaders()
             });
              if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `invoice-${id}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                return { success: true };
            }
             return { success: false, message: "Failed to download" };
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async getDetailedTracking(id) {
        try {
             const response = await fetch(`${API_BASE_URL}/orders/${id}/tracking`, {
                headers: this.getHeaders()
            });
             return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async updateTrackingLocation(id, location, description) {
         try {
             const response = await fetch(`${API_BASE_URL}/orders/${id}/tracking`, {
                 method: 'POST',
                 headers: this.getHeaders(),
                 body: JSON.stringify({ location, description })
             });
             return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static getHeaders() {
         return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TokenService.getToken()}`
        };
    }
}

class ShopsAPI {
    static async getAllShops() {
         try {
             const response = await fetch(`${API_BASE_URL}/shops`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async updateShopStatus(id, status) {
         try {
             const response = await fetch(`${API_BASE_URL}/shops/${id}/status`, {
                 method: 'PATCH',
                 headers: this.getHeaders(),
                 body: JSON.stringify({ status })
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async getProfile() {
        try {
            const response = await fetch(`${API_BASE_URL}/shops/profile`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async getShopPublic(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/shops/public/${id}`);
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }

    static async getDashboard() {
        try {
            const response = await fetch(`${API_BASE_URL}/shops/dashboard`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async getFinance() {
        try {
            const response = await fetch(`${API_BASE_URL}/shops/finance`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static getHeaders() {
         return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TokenService.getToken()}`
        };
    }
}

class CustomersAPI {
    static async getProfile() {
        try {
            const response = await fetch(`${API_BASE_URL}/customers/profile`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async updateProfile(profileData) {
        try {
            const response = await fetch(`${API_BASE_URL}/customers/profile`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(profileData)
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async getAddresses() {
        try {
            const response = await fetch(`${API_BASE_URL}/customers/addresses`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async addAddress(addressData) {
        try {
             const response = await fetch(`${API_BASE_URL}/customers/addresses`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(addressData)
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async updateAddress(id, addressData) {
        try {
             const response = await fetch(`${API_BASE_URL}/customers/addresses/${id}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(addressData)
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async deleteAddress(id) {
        try {
             const response = await fetch(`${API_BASE_URL}/customers/addresses/${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async getWishlist(page = 1, limit = 10) {
        try {
             const response = await fetch(`${API_BASE_URL}/customers/wishlist?page=${page}&limit=${limit}`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async addToWishlist(productId) {
        try {
             const response = await fetch(`${API_BASE_URL}/customers/wishlist`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ productId })
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async removeFromWishlist(productId) {
        try {
             const response = await fetch(`${API_BASE_URL}/customers/wishlist/${productId}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async getAllCustomers() {
         try {
             const response = await fetch(`${API_BASE_URL}/customers`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async updateCustomerStatus(id, status) {
          try {
             const response = await fetch(`${API_BASE_URL}/users/${id}/status`, {
                 method: 'PUT',
                 headers: this.getHeaders(),
                 body: JSON.stringify({ status })
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async uploadAvatar(formData) {
        try {
            const response = await fetch(`${API_BASE_URL}/customers/avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${TokenService.getToken()}`
                },
                body: formData
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
     static getHeaders() {
         return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TokenService.getToken()}`
        };
    }
}

class SupportAPI {
    static async createTicket(data) {
        try {
            const response = await fetch(`${API_BASE_URL}/support/tickets`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async getUserTickets(params = {}) {
         try {
            const query = new URLSearchParams();
            if (params.search) query.set('search', params.search);
            if (params.status) query.set('status', params.status);
            if (params.page) query.set('page', params.page);
            if (params.limit) query.set('limit', params.limit);
            const qs = query.toString();
            const response = await fetch(`${API_BASE_URL}/support/tickets${qs ? '?' + qs : ''}`, {
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async getAllTickets() {
         try {
            const response = await fetch(`${API_BASE_URL}/support/admin/tickets`, {
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async getTicket(id) {
         try {
            const response = await fetch(`${API_BASE_URL}/support/tickets/${id}`, {
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async getTickets() {
        return this.getUserTickets();
    }

    static async getShopTickets() {
         try {
            const response = await fetch(`${API_BASE_URL}/support/shop/tickets`, {
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async addMessage(id, data) {
         try {
            const response = await fetch(`${API_BASE_URL}/support/tickets/${id}/messages`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async closeTicket(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/support/tickets/${id}/close`, {
                method: 'POST',
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }

    static async rateTicket(id, rating) {
        try {
            const response = await fetch(`${API_BASE_URL}/support/tickets/${id}/rating`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ rating })
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }

    static async getTypingStatus(ticketId) {
        try {
            const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/typing`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }

    static async setTypingStatus(ticketId, isTyping) {
        try {
            const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/typing`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ isTyping })
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }

    static async pollMessages(ticketId, after) {
        try {
            const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/messages/poll?after=${encodeURIComponent(after)}`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }

    static async getCannedResponses(shopId) {
        try {
            const response = await fetch(`${API_BASE_URL}/support/canned-responses?shopId=${shopId}`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }

    static async uploadChatFile(ticketId, file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${TokenService.getToken()}` },
                body: formData
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }

    static async markAsRead(ticketId) {
        try {
            const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/read`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({})
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }

    static async getReadStatus(ticketId) {
        try {
            const response = await fetch(`${API_BASE_URL}/support/tickets/${ticketId}/read-status`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }

     static getHeaders() {
         return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TokenService.getToken()}`
        };
    }
}

class AdminAPI {
    static async getDashboard() {
         try {
            const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async getFinance() {
         try {
            const response = await fetch(`${API_BASE_URL}/admin/finance`, {
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async getRoles() {
         try {
            const response = await fetch(`${API_BASE_URL}/admin/permissions/roles`, {
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async getAdmins() {
         try {
            const response = await fetch(`${API_BASE_URL}/admin/permissions/admins`, {
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async updatePermissions(id, permissions, position) {
         try {
             const response = await fetch(`${API_BASE_URL}/admin/permissions/admins/${id}`, {
                 method: 'PATCH',
                 headers: this.getHeaders(),
                 body: JSON.stringify({ permissions, position })
             });
             return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async applyRole(id, roleId) {
         try {
             const response = await fetch(`${API_BASE_URL}/admin/permissions/admins/${id}/apply-role`, {
                 method: 'POST',
                 headers: this.getHeaders(),
                 body: JSON.stringify({ roleId })
             });
             return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async getShops() {
         try {
            const response = await fetch(`${API_BASE_URL}/shops/admin/all`, {
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async updateShopStatus(id, status, commission) {
          try {
             const response = await fetch(`${API_BASE_URL}/shops/${id}/status`, {
                 method: 'PATCH',
                 headers: this.getHeaders(),
                 body: JSON.stringify({ status, commission_rate: commission })
             });
             return await response.json();
         } catch(e) {
              return { success: false, message: e.message };
         }
    }

    static async updateCustomerStatus(id, status) {
          try {
             const response = await fetch(`${API_BASE_URL}/customers/${id}/status`, {
                 method: 'PATCH',
                 headers: this.getHeaders(),
                 body: JSON.stringify({ status })
             });
             return await response.json();
         } catch(e) {
              return { success: false, message: e.message };
         }
    }

    static getHeaders() {
         return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TokenService.getToken()}`
        };
    }
}

class ReviewsAPI {
    static async createReview(reviewData) {
        try {
            const response = await fetch(`${API_BASE_URL}/reviews`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(reviewData)
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async getProductReviews(productId) {
        try {
            const response = await fetch(`${API_BASE_URL}/reviews/product/${productId}`);
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async getMyReviews() {
        try {
            const response = await fetch(`${API_BASE_URL}/reviews/my-reviews`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async replyToReview(id, reply) {
        try {
            const response = await fetch(`${API_BASE_URL}/reviews/${id}/reply`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ reply })
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
    
    static async getAllReviews() {
         try {
            const response = await fetch(`${API_BASE_URL}/reviews/admin/all`, {
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async updateReviewStatus(id, status) {
         try {
            const response = await fetch(`${API_BASE_URL}/reviews/${id}/status`, {
                 method: 'PUT',
                 headers: this.getHeaders(),
                 body: JSON.stringify({ status })
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async deleteReview(id) {
         try {
            const response = await fetch(`${API_BASE_URL}/reviews/${id}`, {
                 method: 'DELETE',
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async getShopReviews() {
        try {
            const response = await fetch(`${API_BASE_URL}/reviews/shop/reviews`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
    
    static getHeaders() {
         return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TokenService.getToken()}`
        };
    }
}

class PromotionsAPI {
    static async getActivePromotions() {
        try {
            const response = await fetch(`${API_BASE_URL}/promotions/active`);
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async validateCoupon(code, shopId, orderAmount) {
        try {
            const response = await fetch(`${API_BASE_URL}/promotions/validate-coupon`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ code, shopId, orderAmount })
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async getShopPromotions() {
        try {
            const response = await fetch(`${API_BASE_URL}/promotions/shop/promotions`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async createPromotion(data) {
        try {
            const response = await fetch(`${API_BASE_URL}/promotions/shop/promotions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async updatePromotion(id, data) {
        try {
            const response = await fetch(`${API_BASE_URL}/promotions/shop/promotions/${id}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    static async deletePromotion(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/promotions/shop/promotions/${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
    
    static async getAllPromotions() {
         try {
            const response = await fetch(`${API_BASE_URL}/promotions`, {
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
     static async createSystemPromotion(data) {
         try {
            const response = await fetch(`${API_BASE_URL}/promotions/system`, {
                 method: 'POST',
                 headers: this.getHeaders(),
                 body: JSON.stringify(data)
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async updateSystemPromotion(id, data) {
         try {
            const response = await fetch(`${API_BASE_URL}/promotions/system/${id}`, {
                 method: 'PUT',
                 headers: this.getHeaders(),
                 body: JSON.stringify(data)
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async deleteSystemPromotion(id) {
         try {
            const response = await fetch(`${API_BASE_URL}/promotions/${id}`, {
                 method: 'DELETE',
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
     static getHeaders() {
         return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TokenService.getToken()}`
        };
    }
}



class NotificationsAPI {
    static async getNotifications() {
         try {
            const response = await fetch(`${API_BASE_URL}/notifications`, {
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }
    
    static async markAsRead(id) {
         try {
            const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
                 method: 'PATCH',
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    static async markAllAsRead() {
         try {
            const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
                 method: 'PATCH',
                 headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
             return { success: false, message: e.message };
        }
    }

    
    static async sendNotification({ userId, title, message }) {
        try {
            const response = await fetch(`${API_BASE_URL}/notifications/send`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ user_id: userId, title, message })
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }

    
    static async sendBulkNotification({ role, title, message }) {
        try {
            const response = await fetch(`${API_BASE_URL}/notifications/send-bulk`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ role, title, message })
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }
    
     static getHeaders() {
         return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TokenService.getToken()}`
        };
    }
}


class PaymentsAPI {
    static async getSavedCards() {
        
        return new Promise((resolve) => {
            setTimeout(() => {
                const cards = JSON.parse(localStorage.getItem('mock_cards') || '[]');
                resolve({ success: true, data: cards });
            }, 500);
        });
    }

    static async addCard(cardData) {
        
        return new Promise((resolve) => {
            setTimeout(() => {
                const cards = JSON.parse(localStorage.getItem('mock_cards') || '[]');
                const newCard = {
                    id: Date.now(),
                    brand: cardData.brand || 'Visa',
                    last4: cardData.number.slice(-4),
                    expiry: cardData.expiry,
                    holder: cardData.holder,
                    isDefault: cards.length === 0
                };
                cards.push(newCard);
                localStorage.setItem('mock_cards', JSON.stringify(cards));
                resolve({ success: true, data: newCard });
            }, 800);
        });
    }

    static async removeCard(id) {
        return new Promise((resolve) => {
            setTimeout(() => {
                let cards = JSON.parse(localStorage.getItem('mock_cards') || '[]');
                cards = cards.filter(c => c.id != id);
                localStorage.setItem('mock_cards', JSON.stringify(cards));
                resolve({ success: true });
            }, 500);
        });
    }
}


class CategoriesAPI {
    static async getAllCategories() {
        try {
            const response = await fetch(`${API_BASE_URL}/categories`, {
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }

    static async getCategories() {
        return this.getAllCategories();
    }

    static async createCategory(data) {
        try {
            const response = await fetch(`${API_BASE_URL}/categories`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }

    static async updateCategory(id, data) {
        try {
            const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }

    static async deleteCategory(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });
            return await response.json();
        } catch(e) {
            return { success: false, message: e.message };
        }
    }

    static getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TokenService.getToken()}`
        };
    }
}


const TokenService = {
    setToken(token) {
        localStorage.setItem('auth_token', token);
    },
    getToken() {
        return localStorage.getItem('auth_token');
    },
    setUser(user) {
        localStorage.setItem('user_info', JSON.stringify(user));
    },
    getUser() {
        const u = localStorage.getItem('user_info');
        return u ? JSON.parse(u) : null;
    },
    clear() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
    }
};

// UI Auth Logic
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
});

function updateAuthUI() {
    const token = TokenService.getToken();
    const user = TokenService.getUser();
    
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    const mobileAuthButtons = document.querySelector('.mobile-menu .auth-buttons'); // If exists
    
    if (token && user) {
        // User is logged in
        if (authButtons) authButtons.classList.remove('show');
        if (userMenu) userMenu.classList.remove('hidden');
        
        // Update user info if elements exist
        const nameEl = document.getElementById('menu-user-name');
        const emailEl = document.getElementById('menu-user-email');
        const avatarEl = document.getElementById('user-avatar');
        
        if (nameEl) nameEl.textContent = `${user.first_name || 'User'} ${user.last_name || ''}`;
        if (emailEl) emailEl.textContent = user.email;
        if (avatarEl) avatarEl.textContent = (user.first_name ? user.first_name[0] : 'U').toUpperCase();
        
    } else {
        // User is not logged in
        if (authButtons) authButtons.classList.add('show');
        if (userMenu) userMenu.classList.add('hidden');
    }
}

function logout() {
    TokenService.clear();
    window.location.href = 'loginPage.html';
}
