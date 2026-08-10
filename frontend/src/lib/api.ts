import axios from "axios";

const TOKEN_KEY = "neon_access_token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  question: string;
  answer: string;
  created_at: string;
}

export interface ChatResponse {
  answer: string;
  sources: string[];
  session_id: string;
}

export interface ChatSession {
  session_id: string;
  title: string;
  message_count: number;
  updated_at: string;
}

export interface DocumentInfo {
  id: number;
  file_name: string;
  uploaded_at: string;
  chunks: number;
}

export interface UploadResponse {
  message: string;
  document_id: number;
  file_name: string;
  chunks: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface Quiz {
  id: number;
  topic: string;
  questions_json: QuizQuestion[];
  score: number | null;
  total_questions: number | null;
  created_at: string;
}

export interface Lesson {
  id: number;
  level: string;
  order_index: number;
  title: string;
  content: string;
  completed: boolean;
}

export interface Course {
  id: number;
  topic: string;
  title: string;
  description: string | null;
  created_at: string;
  lessons: Lesson[];
  completed_lessons: number;
  total_lessons: number;
}

export interface DashboardStats {
  chat_count: number;
  document_count: number;
  quiz_count: number;
  total_chunks: number;
  recent_chats: ChatMessage[];
  recent_documents: DocumentInfo[];
  recent_quizzes: { id: number; topic: string; created_at: string }[];
}

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d: { msg?: string }) => d.msg ?? "")
        .filter(Boolean)
        .join(", ");
    }
    if (detail && typeof detail === "object") {
      return JSON.stringify(detail);
    }
    if (err.message) return err.message;
  }
  return "Something went wrong. Please try again.";
}
