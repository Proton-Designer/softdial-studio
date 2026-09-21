export type AmdResult = 'human' | 'machine' | 'not_sure';

export const PREMIUM_AMD_CONFIG = {
  total_analysis_time_millis: 3500,
  after_greeting_silence_millis: 800,
  between_words_silence_millis: 50,
  maximum_number_of_words: 5,
  silence_threshold: 256,
} as const;

export function normalizeAmdResult(value: string | null | undefined): AmdResult {
  const normalized = (value ?? '').toLowerCase().trim();
  if (normalized === 'human' || normalized === 'human_residence' || normalized === 'human_business')
    return 'human';
  if (normalized === 'machine') return 'machine';
  if (normalized === 'fax_detected' || normalized === 'silence') return 'machine';
  return 'not_sure';
}

export function shouldTreatAsHuman(result: AmdResult): boolean {
  return result === 'human' || result === 'not_sure';
}
