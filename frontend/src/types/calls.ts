// types/calls.ts
export interface Call {
  id: string;
  agent_id: string;
  user_id: string;
  contact_name?: string;
  contact_phone?: string;
  direction?: string;
  status?: string;
  outcome?: string;
  notes?: string;
  call_sid?: string;
  duration_seconds?: number;
  started_at?: string;
  created_at?: string;
  transcription?: any[];
  agents?: {
    id: string;
    name: string;
    description: string;
  };
}
