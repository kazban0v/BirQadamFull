import { httpClient } from './http';

export interface TrustFactorHistoryItem {
  id: number;
  change_amount: number;
  reason: string;
  reason_display: string;
  old_value: number;
  new_value: number;
  created_at: string;
  related_object_type: string;
  related_object_id: number;
}

export interface TrustFactorHistoryResponse {
  history: TrustFactorHistoryItem[];
  current_trust_factor: number;
  current_average_rating: number;
}

export async function fetchTrustFactorHistory(): Promise<TrustFactorHistoryResponse> {
  const { data } = await httpClient.get<TrustFactorHistoryResponse>('/custom-admin/api/v1/trust-factor/history/');
  return data;
}






