export type CourierOption = { id: string; name: string };

export type CourierUser = {
  id: number;
  phone: string | null;
  email: string | null;
  display_name: string | null;
  role: string;
  is_active: boolean;
  created_at?: string;
  updated_at: string | null;
};

export type CourierCreatePayload = {
  ms_courier_id: string;
  phone: string;
  password: string;
  email?: string;
};

export type CourierUpdatePayload = {
  phone?: string;
  email?: string | null;
  display_name?: string | null;
  password?: string;
  is_active?: boolean;
};

export type CourierApiError = {
  status: number;
  message: string;
  code?: string;
};

export type CourierApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: CourierApiError };

export type CourierAdminStatus = { isAdmin: boolean };
