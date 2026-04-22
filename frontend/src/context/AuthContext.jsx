import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("agriflow_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(!!localStorage.getItem("agriflow_token") && !user);

  useEffect(() => {
    // Skip auth check during Google OAuth callback — AuthCallback handles it.
    if (typeof window !== "undefined" && window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    if (localStorage.getItem("agriflow_token") && !user) {
      api
        .get("/auth/me")
        .then((r) => {
          setUser(r.data);
          localStorage.setItem("agriflow_user", JSON.stringify(r.data));
        })
        .catch(() => {
          localStorage.removeItem("agriflow_token");
          localStorage.removeItem("agriflow_user");
        })
        .finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("agriflow_token", data.token);
    localStorage.setItem("agriflow_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const signup = async (payload) => {
    const { data } = await api.post("/auth/signup", payload);
    localStorage.setItem("agriflow_token", data.token);
    localStorage.setItem("agriflow_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("agriflow_token");
    localStorage.removeItem("agriflow_user");
    setUser(null);
  };

  const applyGoogleSession = (data) => {
    // data: {token, user, is_new, next_hint}
    localStorage.setItem("agriflow_token", data.token);
    localStorage.setItem("agriflow_user", JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const value = useMemo(() => ({ user, loading, login, signup, logout, setUser, applyGoogleSession }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
