export type WarehouseAuthStatus = { phone: string | null; hasToken: boolean };

export type OrderItem = {
  id: number;
  number: string;
  order_id: string | null;
  total: number | null;
  client_name: string | null;
  client_phone: string | null;
  items_count: number | null;
  printed: 0 | 1;
  picking_status: "TO_PICK" | "PICKING" | "PICKED" | "PARTIALLY_PICKED" | "PICK_FAILED" | string;
  active_session_id: string | null;
  progress: { picked: number; ordered: number };
  partial_reason_code?: string | null;
  partial_reason_comment?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
};

export type OrdersResponse = { items: OrderItem[]; meta?: { limit?: number; offset?: number } };

export type WarehouseReason = { code: string; label: string };

export type OrderEventsResponse = {
  session_id: string | null;
  events: Array<{
    id: string;
    ts: string | null;
    type: string;
    code: string | null;
    pick_item_id: string | null;
    delta: number | null;
    message: string | null;
    meta: any;
    user_id: number;
  }>;
};

export type OrderDetailResponse = {
  order: { id: number; number: string; order_id: string | null; order_data: any; printed: 0 | 1 };
  picking: null | {
    id: string;
    status: string;
    is_active: boolean;
    partial_reason_code?: string | null;
    partial_reason_comment?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
    progress?: { picked: number; ordered: number };
    items?: Array<{
      id: string;
      name: string;
      sku: string | null;
      ms_assortment_id: string | null;
      barcodes: string[];
      ordered_qty: number;
      picked_qty: number;
    }>;
  };
};
