export interface User {
  id: number;
  full_name: string;
  email: string;
  role: 'member' | 'admin';
  status?: string;
  bio?: string;
  balance: number;
  skills_offered_count?: number;
  skills_wanted_count?: number;
  pending_requests_count?: number;
  upcoming_sessions_count?: number;
  created_at?: string;
}

export interface SkillCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
}

export interface Skill {
  id: number;
  category_id: number;
  name: string;
  description?: string;
  category_name?: string;
  category_icon?: string;
  offer_count?: number;
  want_count?: number;
}

export interface ServiceOffer {
  id: number;
  teacher_id: number;
  skill_id: number;
  title: string;
  description: string;
  duration_minutes: number;
  credit_rate: number;
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  language: string;
  mode: 'online' | 'in-person';
  status: 'active' | 'paused' | 'archived';
  created_at?: string;
  teacher_name?: string;
  teacher_email?: string;
  skill_name?: string;
  category_name?: string;
  teacher_rating?: number;
  review_count?: number;
}

export interface ServiceRequest {
  id: number;
  offer_id: number;
  learner_id: number;
  teacher_id: number;
  proposed_start_at: string;
  requested_duration_minutes: number;
  message?: string;
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Cancelled' | 'Scheduled' | 'Completed' | 'Disputed';
  created_at?: string;
  offer_title?: string;
  credit_rate?: number;
  skill_name?: string;
  teacher_name?: string;
  teacher_email?: string;
  learner_name?: string;
  learner_email?: string;
  session_id?: number;
  meeting_room_id?: string;
  session_status?: string;
}

export interface Session {
  id: number;
  request_id: number;
  teacher_id: number;
  learner_id: number;
  scheduled_start_at: string;
  scheduled_end_at: string;
  actual_start_at?: string;
  actual_end_at?: string;
  eligible_duration_minutes: number;
  meeting_room_id: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  offer_title?: string;
  credit_rate?: number;
  skill_name?: string;
  teacher_name?: string;
  teacher_email?: string;
  learner_name?: string;
  learner_email?: string;
  rating?: number;
  review_comment?: string;
}

export interface TopUpPackage {
  id: 'starter' | 'standard' | 'premium';
  name: string;
  credits: number;
  price_inr: number;
  amount_paise: number;
  learning_minutes: number;
  badge?: string;
  popular?: boolean;
}

export interface PurchaseHistoryItem {
  id: number;
  package_id: string;
  package_name: string;
  credits: number;
  amount_inr: number;
  amount_paise: number;
  currency: string;
  status: 'PAID' | 'PENDING' | 'FAILED' | 'CANCELLED';
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  created_at: string;
  paid_at?: string;
}

export interface LedgerEntry {
  id: number;
  entry_type: 'DEBIT' | 'CREDIT';
  amount: number;
  created_at: string;
  transaction_type: 'SESSION_SETTLEMENT' | 'SIGNUP_BONUS' | 'PURCHASE' | 'ADMIN_ADJUSTMENT';
  idempotency_key: string;
  session_id?: number;
  session_title?: string;
  topup_order_id?: number;
}

export interface WalletData {
  balance: number;
  total_earned: number;
  total_spent: number;
  total_purchased: number;
  total_transactions: number;
  transactions: LedgerEntry[];
  purchases: PurchaseHistoryItem[];
}
