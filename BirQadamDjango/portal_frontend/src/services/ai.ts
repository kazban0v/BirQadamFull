import { httpClient } from './http';

const WEB_ENDPOINT = '/api/web';

export interface AIQuestionRequest {
  question: string;
}

export interface AIQuestionResponse {
  question: string;
  answer: string;
}

export async function askAI(question: string): Promise<AIQuestionResponse> {
  const { data } = await httpClient.post<AIQuestionResponse>(
    `${WEB_ENDPOINT}/ai/ask/`,
    { question }
  );
  return data;
}


