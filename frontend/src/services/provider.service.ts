import { httpService } from './http.service';

export interface ProviderModel {
  value: string;
  label: string;
  context_window: number;
  max_output_tokens: number;
  input_price?: number;
  output_price?: number;
  description?: string;
}

export interface Provider {
  value: string;
  label: string;
  models: ProviderModel[];
}

export async function getProviders(): Promise<Provider[]> {
  return await httpService.get('providers');
}
