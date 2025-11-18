export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  api_key: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  api_key: string;
  created_at: string;
}
