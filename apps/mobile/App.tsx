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

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

type TaskList = { id: string; title: string };
type Task = { id: string; title: string; completed?: boolean; listId: string };

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeList, setActiveList] = useState("inbox");
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("Connect to start");

  async function connect() {
    const res = await fetch(`${API_URL}/auth/google/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "mock" })
    });
    const data = await res.json();
    if (data.token) {
      setToken(data.token);
      setMessage("Connected");
    }
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
        <TouchableOpacity onPress={connect} style={styles.connectButton}>
          <Text style={styles.connectButtonText}>Connect Google</Text>
        </TouchableOpacity>
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
  message: {
    color: "rgba(255,255,255,0.6)",
    marginBottom: 12
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
