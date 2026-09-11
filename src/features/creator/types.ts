export interface CouponData {
  id: string;
  coupon_code: string;
  is_active: boolean;
  created_at: string;
  pix_key_type: string | null;
  pix_key: string | null;
}

export interface RedemptionData {
  id: string;
  created_at: string;
  redeemed_by: string;
  profiles?: {
    email: string;
    full_name: string | null;
  } | null;
}

export interface CouponHistoryData {
  id: string;
  coupon_code: string;
  created_at: string;
  revoked_at: string;
  reason: string | null;
}
