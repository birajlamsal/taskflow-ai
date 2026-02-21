package com.taskflow.app.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.taskflow.app.data.api.TaskFlowApi
import com.taskflow.app.data.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TaskRepository @Inject constructor(
    private val api: TaskFlowApi,
    private val dataStore: DataStore<Preferences>
) {
    companion object {
        private val TOKEN_KEY = stringPreferencesKey("auth_token")
        private val USER_ID_KEY = stringPreferencesKey("user_id")
        private val USER_EMAIL_KEY = stringPreferencesKey("user_email")
    }

    val authToken: Flow<String?> = dataStore.data.map { it[TOKEN_KEY] }
    val userEmail: Flow<String?> = dataStore.data.map { it[USER_EMAIL_KEY] }

    suspend fun getToken(): String? = dataStore.data.first()[TOKEN_KEY]

    suspend fun saveAuth(token: String, user: UserInfo) {
        dataStore.edit { prefs ->
            prefs[TOKEN_KEY] = token
            prefs[USER_ID_KEY] = user.id
            prefs[USER_EMAIL_KEY] = user.email
        }
    }

    suspend fun clearAuth() {
        dataStore.edit { it.clear() }
    }

    private fun bearerToken(token: String) = "Bearer $token"

    suspend fun login(email: String, password: String): Result<AuthResponse> = runCatching {
        val response = api.login(LoginRequest(email, password))
        saveAuth(response.token, response.user)
        response
    }

    suspend fun getLists(): Result<List<TaskList>> = runCatching {
        val token = getToken() ?: error("Not authenticated")
        api.getLists(bearerToken(token))
    }

    suspend fun getTasks(listId: String? = null): Result<List<Task>> = runCatching {
        val token = getToken() ?: error("Not authenticated")
        api.getTasks(bearerToken(token), listId)
    }

    suspend fun createTask(title: String, listId: String, due: String? = null, notes: String? = null): Result<Task> = runCatching {
        val token = getToken() ?: error("Not authenticated")
        api.createTask(bearerToken(token), CreateTaskRequest(title, listId, due, notes))
    }

    suspend fun updateTask(taskId: String, listId: String, status: String): Result<Task> = runCatching {
        val token = getToken() ?: error("Not authenticated")
        api.updateTask(bearerToken(token), taskId, UpdateTaskRequest(status))
    }

    suspend fun deleteTask(taskId: String): Result<Unit> = runCatching {
        val token = getToken() ?: error("Not authenticated")
        api.deleteTask(bearerToken(token), taskId)
    }
}
