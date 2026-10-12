
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  api,
  clearSession,
  getSavedUser,
  saveSession,
} from "../services/api";
import { clearGuestSandbox } from "../services/guestSandbox";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSavedUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("medipilot_token");

    if (
      !token ||
      localStorage.getItem("medipilot_demo_data") === "true"
    ) {
      setLoading(false);
      return;
    }

    // Verify that the saved token is still accepted by the backend.
    api
      .get("/dashboard/me")
      .then((data) => {
        const currentUser =
          data?.user || data?.data?.user || getSavedUser();

        if (currentUser) {
          setUser(currentUser);
          localStorage.setItem(
            "medipilot_user",
            JSON.stringify(currentUser)
          );
        }
      })
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    function synchronizeUserAcrossTabs(event) {
      if (event.key !== "medipilot_user") return;
      clearGuestSandbox();
      if (!event.newValue) {
        setUser(null);
        return;
      }
      try {
        setUser(JSON.parse(event.newValue));
      } catch (error) {
        clearSession();
        setUser(null);
        console.error("Unable to read the updated session user.", error);
      }
    }

    window.addEventListener("storage", synchronizeUserAcrossTabs);
    return () => window.removeEventListener("storage", synchronizeUserAcrossTabs);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post("/auth/login", {
      email,
      password,
    });

    const token = data?.token || data?.data?.token;
    const currentUser =
      data?.user || data?.data?.user;

    if (!token || !currentUser) {
      throw new Error(
        "The server response is missing the login token or user details."
      );
    }

    saveSession(token, currentUser);
    setUser(currentUser);

    return currentUser;
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const data = await api.post("/auth/google", { credential });
    const token = data?.token || data?.data?.token;
    const currentUser = data?.user || data?.data?.user;

    if (!token || !currentUser) {
      throw new Error(
        "The server response is missing the login token or user details."
      );
    }

    saveSession(token, currentUser);
    setUser(currentUser);

    return currentUser;
  }, []);

  const register = useCallback(async (details) => {
    const data = await api.post("/auth/register", details);

    const token = data?.token || data?.data?.token;
    const currentUser =
      data?.user || data?.data?.user;

    // Some backends register the account but require a separate login.
    if (token && currentUser) {
      saveSession(token, currentUser);
      setUser(currentUser);
    }

    return data;
  }, []);

  const startDemo = useCallback((name) => {
    clearGuestSandbox();
    const demoUser = {
      _id: "local-demo-patient",
      name,
      role: "PATIENT",
      isDemo: true,
    };

    clearSession();
    localStorage.setItem("medipilot_user", JSON.stringify(demoUser));
    setUser(demoUser);

    return demoUser;
  }, []);

  const logout = useCallback(() => {
    if (getSavedUser()?.isDemo) clearGuestSandbox();
    clearSession();
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    loginWithGoogle,
    register,
    startDemo,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside an AuthProvider."
    );
  }

  return context;
}
