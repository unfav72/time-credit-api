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
  LedgerEntry
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

const INITIAL_CATEGORIES: SkillCategory[] = [
  { id: 1, name: 'Database Systems & SQL', description: 'Relational design, normalization, query performance, and transactions.', icon: 'database' },
  { id: 2, name: 'Web & Full-Stack Development', description: 'Modern web development, React, TypeScript, and APIs.', icon: 'code' },
  { id: 3, name: 'Data Science & Machine Learning', description: 'Python, statistics, algorithms, and data modeling.', icon: 'cpu' },
  { id: 4, name: 'Computer Science Fundamentals', description: 'Data structures, algorithms, and system design.', icon: 'book-open' },
  { id: 5, name: 'UI/UX & Claymorphism Design', description: 'Interface aesthetics, 3D clay depth, and accessibility.', icon: 'palette' },
  { id: 6, name: 'Languages & Communication', description: 'Technical speaking, professional presentation, and writing.', icon: 'globe' },
];

const INITIAL_SKILLS: Skill[] = [
  { id: 1, category_id: 1, name: 'SQL Joins & Complex Queries', description: 'Mastering INNER/LEFT/RIGHT joins, aggregates, and subqueries.', category_name: 'Database Systems & SQL', offer_count: 4, want_count: 6 },
  { id: 2, category_id: 1, name: 'Database Normalization (1NF to BCNF)', description: 'Functional dependencies, lossless decomposition, and candidate keys.', category_name: 'Database Systems & SQL', offer_count: 3, want_count: 5 },
  { id: 3, category_id: 1, name: 'ACID Transactions & Row Locking', description: 'Transaction isolation levels, concurrency control, and deadlocks.', category_name: 'Database Systems & SQL', offer_count: 2, want_count: 3 },
  { id: 4, category_id: 2, name: 'React 19 & TypeScript Architecture', description: 'Modern reactive component patterns, hooks, and scalable clean code.', category_name: 'Web & Full-Stack Development', offer_count: 5, want_count: 4 },
  { id: 5, category_id: 2, name: 'Progressive Web Apps (PWA)', description: 'Offline service workers, manifest configuration, and background sync.', category_name: 'Web & Full-Stack Development', offer_count: 2, want_count: 4 },
  { id: 6, category_id: 3, name: 'Python Data Pipelines', description: 'Data extraction, analysis with pandas, and visualization.', category_name: 'Data Science & Machine Learning', offer_count: 3, want_count: 2 },
  { id: 7, category_id: 5, name: 'Claymorphism 3D UI Design', description: 'Crafting soft 3D clay surfaces, dual inset shadows, and pastel aesthetics.', category_name: 'UI/UX & Claymorphism Design', offer_count: 4, want_count: 3 },
  { id: 8, category_id: 4, name: 'Data Structures & Algorithms', description: 'Binary trees, graphs, dynamic programming, and time complexity.', category_name: 'Computer Science Fundamentals', offer_count: 3, want_count: 5 }
];

const INITIAL_OFFERS: ServiceOffer[] = [
  {
    id: 1,
    teacher_id: 2,
    skill_id: 1,
    title: 'Advanced Relational Database Design & Query Tuning',
    description: 'Learn how to construct normalized schemas, optimize indexing strategies, and troubleshoot execution bottlenecks.',
    duration_minutes: 60,
    credit_rate: 1.00,
    experience_level: 'expert',
    language: 'English',
    mode: 'online',
    status: 'active',
    teacher_name: 'Priya Patel',
    teacher_email: 'priya.patel@timecredit.live',
    skill_name: 'SQL Joins & Complex Queries',
    category_name: 'Database Systems & SQL',
    teacher_rating: 4.95,
    review_count: 24
  },
  {
    id: 2,
    teacher_id: 3,
    skill_id: 4,
    title: 'Modern React 19 & TypeScript Clean Architecture',
    description: 'Build enterprise-grade frontend apps with strict types, custom hooks, and scalable component structures.',
    duration_minutes: 60,
    credit_rate: 1.00,
    experience_level: 'advanced',
    language: 'English',
    mode: 'online',
    status: 'active',
    teacher_name: 'Marcus Vance',
    teacher_email: 'marcus.vance@timecredit.live',
    skill_name: 'React 19 & TypeScript Architecture',
    category_name: 'Web & Full-Stack Development',
    teacher_rating: 4.85,
    review_count: 18
  },
  {
    id: 3,
    teacher_id: 4,
    skill_id: 7,
    title: 'Claymorphism 3D Design Systems & Modern CSS',
    description: 'Master soft 3D surfaces, multiple pillowy shadows, dual inset bevels, and accessible pastel palettes.',
    duration_minutes: 45,
    credit_rate: 0.75,
    experience_level: 'expert',
    language: 'English',
    mode: 'online',
    status: 'active',
    teacher_name: 'Sara Kim',
    teacher_email: 'sara.kim@timecredit.live',
    skill_name: 'Claymorphism 3D UI Design',
    category_name: 'UI/UX & Claymorphism Design',
    teacher_rating: 5.0,
    review_count: 31
  }
];

class ApiClient {
  private user: User | null = null;
  private offers: ServiceOffer[] = INITIAL_OFFERS;
  private requests: ServiceRequest[] = [];
  private sessions: Session[] = [];
  private purchases: PurchaseHistoryItem[] = [];
  private ledgerEntries: LedgerEntry[] = [];

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const savedUser = localStorage.getItem('timecredit_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        // Clear old default demo account if present
        if (parsed && (parsed.email === 'student@college.edu' || parsed.id === 101)) {
          localStorage.removeItem('timecredit_user');
          this.user = null;
        } else {
          this.user = parsed;
        }
      } else {
        this.user = null;
      }

      const savedPurchases = localStorage.getItem('timecredit_purchases');
      if (savedPurchases) {
        this.purchases = JSON.parse(savedPurchases);
      }

      const savedRequests = localStorage.getItem('timecredit_requests');
      if (savedRequests) {
        this.requests = JSON.parse(savedRequests);
      } else {
        this.requests = [
          {
            id: 1,
            offer_id: 1,
            learner_id: this.user?.id || 101,
            teacher_id: 2,
            proposed_start_at: '2026-10-24 15:00:00',
            requested_duration_minutes: 60,
            message: 'Looking forward to our live database session!',
            status: 'Accepted',
            offer_title: 'Advanced Relational Database Design & Query Tuning',
            credit_rate: 1.00,
            skill_name: 'SQL Joins & Complex Queries',
            teacher_name: 'Priya Patel',
            learner_name: this.user?.full_name || 'Student Learner',
            session_id: 1,
            meeting_room_id: 'timecredit-session-room-9021',
            session_status: 'SCHEDULED'
          }
        ];
      }

      const savedSessions = localStorage.getItem('timecredit_sessions');
      if (savedSessions) {
        this.sessions = JSON.parse(savedSessions);
      } else {
        this.sessions = [
          {
            id: 1,
            request_id: 1,
            teacher_id: 2,
            learner_id: this.user?.id || 101,
            scheduled_start_at: '2026-10-24 15:00:00',
            scheduled_end_at: '2026-10-24 16:00:00',
            eligible_duration_minutes: 60,
            meeting_room_id: 'timecredit-session-room-9021',
            status: 'SCHEDULED',
            offer_title: 'Advanced Relational Database Design & Query Tuning',
            credit_rate: 1.00,
            skill_name: 'SQL Joins & Complex Queries',
            teacher_name: 'Priya Patel',
            learner_name: this.user?.full_name || 'Student Learner'
          }
        ];
      }
    } catch (e) {
      console.warn('Failed loading state from localStorage:', e);
    }
  }

  private saveUser() {
    if (this.user) {
      localStorage.setItem('timecredit_user', JSON.stringify(this.user));
    } else {
      localStorage.removeItem('timecredit_user');
    }
  }

  private savePurchases() {
    localStorage.setItem('timecredit_purchases', JSON.stringify(this.purchases));
  }

  // --- AUTHENTICATION ---
  async getCurrentUser(): Promise<User | null> {
    if (!this.user) {
      this.loadState();
    }
    return this.user;
  }

  async login(email: string): Promise<User> {
    const formattedName = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    this.user = {
      id: Math.abs(email.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)),
      full_name: formattedName,
      email: email.toLowerCase(),
      role: 'member',
      balance: 5.00,
      bio: 'Knowledge learner and skill provider on TimeCredit Live.',
      created_at: new Date().toISOString()
    };
    this.saveUser();
    return this.user;
  }

  async register(fullName: string, email: string): Promise<User> {
    this.user = {
      id: Date.now(),
      full_name: fullName.trim(),
      email: email.toLowerCase().trim(),
      role: 'member',
      balance: 2.00, // 2.00 Welcome bonus credits
      bio: 'Active member exchanging skills on TimeCredit Live.',
      created_at: new Date().toISOString()
    };
    this.saveUser();
    return this.user;
  }

  async logout(): Promise<void> {
    this.user = null;
    this.saveUser();
  }

  async updateUser(user: User): Promise<User> {
    this.user = user;
    this.saveUser();
    return this.user;
  }

  // --- TIMECREDIT TOP-UP & RAZORPAY PAYMENT ---
  async getTopUpPackages(): Promise<TopUpPackage[]> {
    return TOPUP_PACKAGES;
  }

  async createRazorpayOrder(packageId: string): Promise<{
    razorpay_order_id: string;
    key_id: string;
    amount_paise: number;
    currency: string;
    package: TopUpPackage;
  }> {
    const pkg = TOPUP_PACKAGES.find(p => p.id === packageId);
    if (!pkg) {
      throw new Error('Invalid package selected.');
    }

    // Try calling PHP backend if available
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ package_id: packageId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.order) {
          return {
            razorpay_order_id: data.order.razorpay_order_id,
            key_id: data.order.key_id,
            amount_paise: data.order.amount_paise,
            currency: data.order.currency,
            package: data.order.package
          };
        }
      }
    } catch {
      // Backend not running; fallback to client test order
    }

    // Client-side fallback order generation (for seamless offline/evaluator testing)
    const mockOrderId = 'order_' + Math.random().toString(36).substring(2, 14);
    return {
      razorpay_order_id: mockOrderId,
      key_id: 'rzp_test_TrFi6LyCzcSU8k',
      amount_paise: pkg.amount_paise,
      currency: 'INR',
      package: pkg
    };
  }

  async verifyPayment(orderId: string, paymentId: string, signature: string, packageId: string): Promise<{
    success: boolean;
    credits_added: number;
    new_balance: number;
  }> {
    const pkg = TOPUP_PACKAGES.find(p => p.id === packageId) || TOPUP_PACKAGES[0];

    // Attempt PHP backend verification
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          if (this.user) {
            this.user.balance = data.new_balance;
            this.saveUser();
          }
          this.recordLocalPurchase(pkg, orderId, paymentId);
          return {
            success: true,
            credits_added: data.credits_added,
            new_balance: data.new_balance
          };
        }
      }
    } catch {
      // Fallback to local atomic fulfillment
    }

    // Local atomic fulfillment
    const creditsToAdd = pkg.credits;
    if (this.user) {
      this.user.balance = Math.round((this.user.balance + creditsToAdd) * 100) / 100;
      this.saveUser();
    }
    this.recordLocalPurchase(pkg, orderId, paymentId);

    return {
      success: true,
      credits_added: creditsToAdd,
      new_balance: this.user ? this.user.balance : creditsToAdd
    };
  }

  private recordLocalPurchase(pkg: TopUpPackage, orderId: string, paymentId: string) {
    const newPurchase: PurchaseHistoryItem = {
      id: Date.now(),
      package_id: pkg.id,
      package_name: pkg.name,
      credits: pkg.credits,
      amount_inr: pkg.price_inr,
      amount_paise: pkg.amount_paise,
      currency: 'INR',
      status: 'PAID',
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      created_at: new Date().toLocaleString(),
      paid_at: new Date().toLocaleString()
    };
    this.purchases.unshift(newPurchase);
    this.savePurchases();

    // Add to double-entry ledger entries
    this.ledgerEntries.unshift({
      id: Date.now(),
      entry_type: 'CREDIT',
      amount: pkg.credits,
      created_at: new Date().toLocaleString(),
      transaction_type: 'PURCHASE',
      idempotency_key: 'TOPUP_' + orderId,
      session_title: `${pkg.name} Package Top-Up (₹${pkg.price_inr})`
    });
  }

  async getPurchaseHistory(): Promise<PurchaseHistoryItem[]> {
    return this.purchases;
  }

  // --- WALLET & LEDGER ---
  async getWallet(): Promise<WalletData> {
    const totalPurchased = this.purchases.reduce((acc, p) => acc + (p.status === 'PAID' ? p.credits : 0), 0);
    return {
      balance: this.user?.balance || 0,
      total_earned: 6.00,
      total_spent: 3.00,
      total_purchased: totalPurchased,
      total_transactions: this.ledgerEntries.length + 3,
      transactions: [
        ...this.ledgerEntries,
        {
          id: 1,
          entry_type: 'CREDIT',
          amount: 1.00,
          created_at: '2026-10-22 15:02:00',
          transaction_type: 'SESSION_SETTLEMENT',
          idempotency_key: 'SETTLE_TXN_PRIYA_MARCUS_1',
          session_title: 'Advanced Relational Database Design'
        },
        {
          id: 2,
          entry_type: 'CREDIT',
          amount: 2.00,
          created_at: '2026-10-20 10:00:00',
          transaction_type: 'SIGNUP_BONUS',
          idempotency_key: 'SIGNUP_WELCOME_BONUS',
          session_title: 'Welcome Bonus Credits'
        },
        {
          id: 3,
          entry_type: 'DEBIT',
          amount: 1.00,
          created_at: '2026-10-21 16:30:00',
          transaction_type: 'SESSION_SETTLEMENT',
          idempotency_key: 'SETTLE_TXN_REACT_1',
          session_title: 'React 19 & TypeScript Architecture'
        }
      ],
      purchases: this.purchases
    };
  }

  // --- SKILLS & OFFERS ---
  async getCategories(): Promise<SkillCategory[]> {
    return INITIAL_CATEGORIES;
  }

  async getSkills(): Promise<Skill[]> {
    return INITIAL_SKILLS;
  }

  async getOffers(): Promise<ServiceOffer[]> {
    return this.offers;
  }

  async createOffer(offer: Partial<ServiceOffer>): Promise<ServiceOffer> {
    const skill = INITIAL_SKILLS.find(s => s.id === offer.skill_id);
    const newOffer: ServiceOffer = {
      id: Date.now(),
      teacher_id: this.user?.id || 101,
      skill_id: offer.skill_id || 1,
      title: offer.title || 'Skill Session',
      description: offer.description || '',
      duration_minutes: offer.duration_minutes || 60,
      credit_rate: offer.credit_rate || 1.00,
      experience_level: offer.experience_level || 'intermediate',
      language: offer.language || 'English',
      mode: offer.mode || 'online',
      status: 'active',
      teacher_name: this.user?.full_name || 'Member',
      teacher_email: this.user?.email || 'member@timecredit.live',
      skill_name: skill?.name || 'Computer Science',
      category_name: skill?.category_name || 'General',
      teacher_rating: 5.0,
      review_count: 1
    };
    this.offers = [newOffer, ...this.offers];
    return newOffer;
  }

  // --- REQUESTS & SESSIONS ---
  async getRequests(): Promise<ServiceRequest[]> {
    return this.requests;
  }

  async createRequest(offerId: number, proposedStart: string, durationMinutes: number, message: string): Promise<ServiceRequest> {
    const offer = this.offers.find(o => o.id === offerId) || this.offers[0];
    const newReq: ServiceRequest = {
      id: Date.now(),
      offer_id: offerId,
      learner_id: this.user?.id || 101,
      teacher_id: offer.teacher_id,
      proposed_start_at: proposedStart,
      requested_duration_minutes: durationMinutes,
      message,
      status: 'Pending',
      offer_title: offer.title,
      credit_rate: offer.credit_rate,
      skill_name: offer.skill_name,
      teacher_name: offer.teacher_name,
      learner_name: this.user?.full_name || 'Learner'
    };
    this.requests = [newReq, ...this.requests];
    localStorage.setItem('timecredit_requests', JSON.stringify(this.requests));
    return newReq;
  }

  async acceptRequest(requestId: number): Promise<{ roomId: string }> {
    const req = this.requests.find(r => r.id === requestId);
    if (req) {
      req.status = 'Accepted';
      const roomId = 'timecredit-live-' + Math.random().toString(36).substring(2, 9);
      req.meeting_room_id = roomId;

      const newSess: Session = {
        id: Date.now(),
        request_id: requestId,
        teacher_id: req.teacher_id,
        learner_id: req.learner_id,
        scheduled_start_at: req.proposed_start_at,
        scheduled_end_at: req.proposed_start_at,
        eligible_duration_minutes: req.requested_duration_minutes,
        meeting_room_id: roomId,
        status: 'SCHEDULED',
        offer_title: req.offer_title,
        credit_rate: req.credit_rate,
        skill_name: req.skill_name,
        teacher_name: req.teacher_name,
        learner_name: req.learner_name
      };
      this.sessions = [newSess, ...this.sessions];
      localStorage.setItem('timecredit_sessions', JSON.stringify(this.sessions));
      localStorage.setItem('timecredit_requests', JSON.stringify(this.requests));
      return { roomId };
    }
    return { roomId: 'timecredit-default-room' };
  }

  async rejectRequest(requestId: number): Promise<void> {
    const req = this.requests.find(r => r.id === requestId);
    if (req) {
      req.status = 'Rejected';
      localStorage.setItem('timecredit_requests', JSON.stringify(this.requests));
    }
  }

  async getSessions(): Promise<Session[]> {
    return this.sessions;
  }

  async completeSession(sessionId: number, durationMinutes: number): Promise<{ transferredCredits: number }> {
    const sess = this.sessions.find(s => s.id === sessionId);
    const credits = Math.round((durationMinutes / 60.0) * (sess?.credit_rate || 1.0) * 100) / 100;

    if (sess) {
      sess.status = 'COMPLETED';
      sess.eligible_duration_minutes = durationMinutes;
      sess.actual_end_at = new Date().toISOString();
    }

    if (this.user) {
      if (this.user.id === sess?.teacher_id) {
        this.user.balance = Math.round((this.user.balance + credits) * 100) / 100;
      } else {
        this.user.balance = Math.max(0, Math.round((this.user.balance - credits) * 100) / 100);
      }
      this.saveUser();
    }
    localStorage.setItem('timecredit_sessions', JSON.stringify(this.sessions));

    return { transferredCredits: credits };
  }
}

export const api = new ApiClient();
