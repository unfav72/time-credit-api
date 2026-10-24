import type {
  User,
  Skill,
  SkillCategory,
  ServiceOffer,
  ServiceRequest,
  Session,
  WalletData,
  TopUpPackage,
  PurchaseHistoryItem,
  AppNotification,
  WhiteboardStroke,
  MeetingChatMessage,
  MeetingConfig
} from '../types';

export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

export const TOPUP_PACKAGES: TopUpPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 10,
    price_inr: 27,
    amount_paise: 2700,
    learning_minutes: 150,
    badge: '150 mins',
    popular: false
  },
  {
    id: 'standard',
    name: 'Standard',
    credits: 20,
    price_inr: 52,
    amount_paise: 5200,
    learning_minutes: 300,
    badge: '300 mins (5 hrs)',
    popular: true
  },
  {
    id: 'premium',
    name: 'Premium',
    credits: 30,
    price_inr: 75,
    amount_paise: 7500,
    learning_minutes: 450,
    badge: '450 mins (7.5 hrs)',
    popular: false
  }
];

class ApiClient {
  private token: string | null = null;
  private currentUser: User | null = null;

  constructor() {
    this.token = localStorage.getItem('timecredit_auth_token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('timecredit_auth_token', token);
    } else {
      localStorage.removeItem('timecredit_auth_token');
    }
  }

  public getToken(): string | null {
    return this.token || localStorage.getItem('timecredit_auth_token');
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
      const errorMessage = data?.error || `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return data as T;
  }

  // =========================================================================
  // 1. AUTHENTICATION & PROFILES
  // =========================================================================

  async getCurrentUser(): Promise<User | null> {
    try {
      const res = await this.request<{ user: User; token?: string }>('/api/v1/me', { method: 'GET' });
      if (res?.user) {
        this.currentUser = res.user;
        if (res.token) this.setToken(res.token);
        return res.user;
      }
    } catch {
      // Not logged in or invalid token
      this.currentUser = null;
    }
    return null;
  }

  async login(email: string, password = 'password123'): Promise<User> {
    const res = await this.request<{ user: User; token: string; message: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.currentUser = res.user;
    if (res.token) {
      this.setToken(res.token);
    }
    return res.user;
  }

  async register(fullName: string, email: string, password = 'password123', confirmPassword = 'password123'): Promise<User> {
    const res = await this.request<{ user: User; token: string; message: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
        confirm_password: confirmPassword
      })
    });
    this.currentUser = res.user;
    if (res.token) {
      this.setToken(res.token);
    }
    return res.user;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    this.setToken(null);
    this.currentUser = null;
    localStorage.removeItem('timecredit_user');
  }

  async updateProfile(fullName: string, bio: string): Promise<User> {
    const res = await this.request<{ user: User; message: string }>('/api/v1/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ full_name: fullName, bio })
    });
    this.currentUser = res.user;
    return res.user;
  }

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
    await this.request('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      })
    });
  }

  async getPublicProfile(userId: number): Promise<{ profile: any; skills: any[]; offers: any[]; reviews: any[] }> {
    return this.request(`/api/v1/users/${userId}/profile`, { method: 'GET' });
  }

  // =========================================================================
  // 2. SKILL CATALOG & OFFER MANAGEMENT (PostgreSQL-backed)
  // =========================================================================

  async getCategories(): Promise<SkillCategory[]> {
    const res = await this.request<{ categories: SkillCategory[] }>('/api/v1/categories', { method: 'GET' });
    return res.categories || [];
  }

  async getSkills(): Promise<Skill[]> {
    const res = await this.request<{ skills: Skill[] }>('/api/v1/skills', { method: 'GET' });
    return res.skills || [];
  }

  async createSkill(name: string, categoryId: number, description: string): Promise<{ id: number }> {
    return this.request('/api/v1/skills', {
      method: 'POST',
      body: JSON.stringify({ name, category_id: categoryId, description })
    });
  }

  async getOffers(category?: string, search?: string): Promise<ServiceOffer[]> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<{ offers: ServiceOffer[] }>(`/api/v1/offers${query}`, { method: 'GET' });
    return res.offers || [];
  }

  async createOffer(offer: Partial<ServiceOffer>): Promise<ServiceOffer> {
    const res = await this.request<{ message: string; id: number }>('/api/v1/offers', {
      method: 'POST',
      body: JSON.stringify(offer)
    });
    return {
      ...(offer as any),
      id: res.id,
      status: 'active'
    };
  }

  async getUserSkills(): Promise<{ offered: any[]; wanted: any[] }> {
    return this.request('/api/v1/user/skills', { method: 'GET' });
  }

  async addUserSkill(skillId: number, skillType: 'OFFER' | 'WANT', experienceLevel = 'intermediate'): Promise<void> {
    await this.request('/api/v1/user/skills', {
      method: 'POST',
      body: JSON.stringify({ skill_id: skillId, skill_type: skillType, experience_level: experienceLevel })
    });
  }

  async removeUserSkill(id: number): Promise<void> {
    await this.request(`/api/v1/user/skills/${id}`, { method: 'DELETE' });
  }

  async getSkillMatches(): Promise<any[]> {
    const res = await this.request<{ matches: any[] }>('/api/v1/skills/matches', { method: 'GET' });
    return res.matches || [];
  }

  // =========================================================================
  // 3. EXCHANGE REQUESTS & LIVE SESSIONS
  // =========================================================================

  async getRequests(): Promise<ServiceRequest[]> {
    const res = await this.request<{ requests: ServiceRequest[] }>('/api/v1/requests', { method: 'GET' });
    return res.requests || [];
  }

  async createRequest(offerId: number, proposedStart: string, durationMinutes: number, message: string): Promise<{ id: number }> {
    return this.request('/api/v1/requests', {
      method: 'POST',
      body: JSON.stringify({
        offer_id: offerId,
        proposed_start_at: proposedStart,
        requested_duration_minutes: durationMinutes,
        message
      })
    });
  }

  async acceptRequest(requestId: number): Promise<{ roomId: string }> {
    const res = await this.request<{ message: string; room_id: string }>(`/api/v1/requests/${requestId}/accept`, {
      method: 'POST'
    });
    return { roomId: res.room_id };
  }

  async rejectRequest(requestId: number): Promise<void> {
    await this.request(`/api/v1/requests/${requestId}/reject`, { method: 'POST' });
  }

  async getSessions(): Promise<Session[]> {
    const res = await this.request<{ sessions: Session[] }>('/api/v1/sessions', { method: 'GET' });
    return res.sessions || [];
  }

  async joinSession(sessionId: number): Promise<{ roomId: string; isTeacher: boolean }> {
    const res = await this.request<{ room_id: string; is_teacher: boolean }>(`/api/v1/sessions/${sessionId}/join`, {
      method: 'POST'
    });
    return { roomId: res.room_id, isTeacher: res.is_teacher };
  }

  async completeSession(sessionId: number, durationMinutes: number): Promise<{ transferredCredits: number }> {
    const idempotencyKey = `SETTLE_${sessionId}_${Date.now()}`;
    const res = await this.request<{ credits_transferred: number }>(`/api/v1/sessions/${sessionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        duration_minutes: durationMinutes,
        idempotency_key: idempotencyKey
      })
    });
    return { transferredCredits: res.credits_transferred };
  }

  async submitReview(sessionId: number, rating: number, comment: string): Promise<void> {
    await this.request(`/api/v1/sessions/${sessionId}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment })
    });
  }

  // =========================================================================
  // 4. WALLET & RAZORPAY TOP-UP
  // =========================================================================

  async getTopUpPackages(): Promise<TopUpPackage[]> {
    try {
      const res = await this.request<{ packages: TopUpPackage[] }>('/api/v1/topup/packages', { method: 'GET' });
      return res.packages || TOPUP_PACKAGES;
    } catch {
      return TOPUP_PACKAGES;
    }
  }

  async createRazorpayOrder(packageId: string): Promise<{
    razorpay_order_id: string;
    key_id: string;
    amount_paise: number;
    currency: string;
    package: TopUpPackage;
  }> {
    const res = await this.request<{
      success: boolean;
      order: {
        internal_order_id: number;
        razorpay_order_id: string;
        key_id: string;
        amount_paise: number;
        currency: string;
        package: TopUpPackage;
      }
    }>('/api/v1/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ package_id: packageId })
    });

    if (!res?.order?.razorpay_order_id) {
      throw new Error('Failed to create server-verified Razorpay order.');
    }

    return {
      razorpay_order_id: res.order.razorpay_order_id,
      key_id: res.order.key_id,
      amount_paise: res.order.amount_paise,
      currency: res.order.currency,
      package: res.order.package
    };
  }

  async verifyPayment(orderId: string, paymentId: string, signature: string, packageId?: string): Promise<{
    success: boolean;
    credits_added: number;
    new_balance: number;
  }> {
    const res = await this.request<{
      success: boolean;
      credits_added: number;
      new_balance: number;
    }>('/api/v1/payments/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature
      })
    });

    if (this.currentUser) {
      this.currentUser.balance = res.new_balance;
    }

    return {
      success: res.success,
      credits_added: res.credits_added,
      new_balance: res.new_balance
    };
  }

  async getPurchaseHistory(): Promise<PurchaseHistoryItem[]> {
    const res = await this.request<{ history: PurchaseHistoryItem[] }>('/api/v1/payments/history', { method: 'GET' });
    return res.history || [];
  }

  async getWallet(): Promise<WalletData> {
    const [walletRes, historyRes] = await Promise.all([
      this.request<{
        balance: number;
        total_earned: number;
        total_spent: number;
        total_transactions: number;
        transactions: any[];
      }>('/api/v1/wallet', { method: 'GET' }),
      this.getPurchaseHistory()
    ]);

    const totalPurchased = historyRes.reduce((acc, p) => acc + (p.status === 'PAID' ? p.credits : 0), 0);

    return {
      balance: walletRes.balance,
      total_earned: walletRes.total_earned,
      total_spent: walletRes.total_spent,
      total_purchased: totalPurchased,
      total_transactions: walletRes.total_transactions,
      transactions: walletRes.transactions || [],
      purchases: historyRes
    };
  }

  // =========================================================================
  // 5. IN-APP NOTIFICATIONS & WEB PUSH
  // =========================================================================

  async getNotifications(): Promise<{ notifications: AppNotification[]; unread_count: number }> {
    const res = await this.request<{ notifications: AppNotification[]; unread_count: number }>('/api/v1/notifications', {
      method: 'GET'
    });
    return res;
  }

  async markNotificationAsRead(notificationId: number): Promise<void> {
    await this.request(`/api/v1/notifications/${notificationId}/read`, { method: 'POST' });
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.request('/api/v1/notifications/read-all', { method: 'POST' });
  }

  async getVapidPublicKey(): Promise<string> {
    const res = await this.request<{ public_key: string }>('/api/v1/push/public-key', { method: 'GET' });
    return res.public_key;
  }

  async subscribePush(subscription: PushSubscriptionJSON): Promise<void> {
    await this.request('/api/v1/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription)
    });
  }

  async unsubscribePush(endpoint?: string): Promise<void> {
    await this.request('/api/v1/push/subscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint })
    });
  }

  // =========================================================================
  // 6. COLLABORATIVE WHITEBOARD & IN-MEETING CHAT
  // =========================================================================

  async getMeetingConfig(sessionId: number): Promise<MeetingConfig> {
    return this.request(`/api/v1/sessions/${sessionId}/meeting-config`, { method: 'GET' });
  }

  async getWhiteboard(sessionId: number, sinceId = 0): Promise<{ strokes: WhiteboardStroke[]; snapshot_version: number }> {
    const query = sinceId > 0 ? `?since_id=${sinceId}` : '';
    return this.request(`/api/v1/sessions/${sessionId}/whiteboard${query}`, { method: 'GET' });
  }

  async addWhiteboardStroke(sessionId: number, stroke: WhiteboardStroke): Promise<{ id: number; stroke_id: string }> {
    return this.request(`/api/v1/sessions/${sessionId}/whiteboard/stroke`, {
      method: 'POST',
      body: JSON.stringify(stroke)
    });
  }

  async clearWhiteboard(sessionId: number): Promise<void> {
    await this.request(`/api/v1/sessions/${sessionId}/whiteboard/clear`, { method: 'POST' });
  }

  async getMeetingChat(sessionId: number, sinceId = 0): Promise<MeetingChatMessage[]> {
    const query = sinceId > 0 ? `?since_id=${sinceId}` : '';
    const res = await this.request<{ messages: MeetingChatMessage[] }>(`/api/v1/sessions/${sessionId}/chat${query}`, {
      method: 'GET'
    });
    return res.messages || [];
  }

  async sendMeetingChat(sessionId: number, message: string): Promise<MeetingChatMessage> {
    return this.request(`/api/v1/sessions/${sessionId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }
}

export const api = new ApiClient();
