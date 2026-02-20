import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { supabase } from "./lib/supabase";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

type TaskList = { id: string; title: string };
type Task = { id: string; title: string; completed?: boolean; listId: string };

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeList, setActiveList] = useState("inbox");
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("Sign in to start");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setToken(data.session?.access_token ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function connect() {
    if (!email || !password) {
      setMessage("Email and password required.");
      return;
    }
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage("Check your email to confirm.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Signed in.");
  }

  async function loadLists(t = token) {
    if (!t) return;
    const res = await fetch(`${API_URL}/tasklists`, {
      headers: { Authorization: `Bearer ${t}` }
    });
    const data = await res.json();
    setLists(data);
    if (data[0]) setActiveList(data[0].id);
  }

  async function loadTasks(listId = activeList, t = token) {
    if (!t) return;
    const res = await fetch(`${API_URL}/tasklists/${listId}/tasks`, {
      headers: { Authorization: `Bearer ${t}` }
    });
    const data = await res.json();
    setTasks(data);
  }

  useEffect(() => {
    if (token) loadLists(token);
  }, [token]);

  useEffect(() => {
    if (token && activeList) loadTasks(activeList, token);
  }, [activeList, token]);

  async function addTask() {
    if (!token || !input.trim()) return;
    const res = await fetch(`${API_URL}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ title: input, listId: activeList })
    });
    const data = await res.json();
    setTasks((prev) => [...prev, data]);
    setInput("");
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerLabel}>TASKFLOW</Text>
        <Text style={styles.headerTitle}>Mobile Flow</Text>
      </View>

      {!token ? (
        <View style={styles.authCard}>
          <View style={styles.authTabs}>
            <TouchableOpacity
              onPress={() => setMode("signin")}
              style={[styles.authTab, mode === "signin" ? styles.authTabActive : null]}
            >
              <Text style={styles.authTabText}>Sign in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMode("signup")}
              style={[styles.authTab, mode === "signup" ? styles.authTabActive : null]}
            >
              <Text style={styles.authTabText}>Sign up</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#6b7280"
            secureTextEntry
            style={styles.input}
          />
          <TouchableOpacity onPress={connect} style={styles.connectButton}>
            <Text style={styles.connectButtonText}>
              {mode === "signup" ? "Create account" : "Sign in"}
            </Text>
          </TouchableOpacity>
          <Text style={styles.message}>{message}</Text>
        </View>
      ) : (
        <Text style={styles.message}>{message}</Text>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Lists</Text>
        <View style={styles.listRow}>
          {lists.map((list) => (
            <TouchableOpacity
              key={list.id}
              onPress={() => setActiveList(list.id)}
              style={[
                styles.listChip,
                activeList === list.id ? styles.listChipActive : styles.listChipIdle
              ]}
            >
              <Text style={styles.listChipText}>{list.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Add a task"
            placeholderTextColor="#6b7280"
            style={styles.input}
          />
          <TouchableOpacity onPress={addTask} style={styles.addButton}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.taskList}>
          {tasks.map((task) => (
            <View key={task.id} style={styles.taskCard}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={styles.taskStatus}>{task.completed ? "Done" : "Open"}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0f1a",
    paddingHorizontal: 24
  },
  header: {
    paddingVertical: 24
  },
  headerLabel: {
    fontSize: 11,
    letterSpacing: 4,
    color: "rgba(255,255,255,0.5)"
  },
  headerTitle: {
    fontSize: 24,
    color: "#ffffff",
    fontWeight: "600"
  },
  message: {
    color: "rgba(255,255,255,0.6)",
    marginBottom: 12
  },
  connectButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999
  },
  connectButtonText: {
    color: "#ffffff",
    textAlign: "center"
  },
  authCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    gap: 10
  },
  authTabs: {
    flexDirection: "row",
    gap: 8
  },
  authTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  authTabActive: {
    backgroundColor: "rgba(255,255,255,0.2)"
  },
  authTabText: {
    color: "#ffffff",
    fontSize: 12
  },
  section: {
    marginTop: 24
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginBottom: 8
  },
  listRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  listChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999
  },
  listChipActive: {
    backgroundColor: "rgba(255,255,255,0.2)"
  },
  listChipIdle: {
    backgroundColor: "rgba(255,255,255,0.1)"
  },
  listChipText: {
    color: "#ffffff",
    fontSize: 12
  },
  inputRow: {
    flexDirection: "row",
    gap: 8
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12
  },
  addButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: "center"
  },
  addButtonText: {
    color: "#ffffff"
  },
  taskList: {
    marginTop: 16,
    gap: 8
  },
  taskCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16
  },
  taskTitle: {
    color: "#ffffff",
    fontSize: 14
  },
  taskStatus: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12
  }
});
