// Example code - replace with your package implementation
export interface User {
  id: string;
  name: string;
  email: string;
}

export const createUser = (name: string, email: string): User => {
  return {
    id: Math.random().toString(36).substring(7),
    name,
    email,
  };
};
