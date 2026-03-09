import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('serverdock_jwt') || null,
  setToken: (token) => {
    if (token) {
      localStorage.setItem('serverdock_jwt', token);
    } else {
      localStorage.removeItem('serverdock_jwt');
    }
    set({ token });
  }
}));

