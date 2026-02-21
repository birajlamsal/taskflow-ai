package com.taskflow.app.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class Task(
    val id: String,
    val title: String,
    val notes: String? = null,
    val due: String? = null,
    val completed: Boolean = false,
    val listId: String,
    val listName: String? = null,
    val tags: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class TaskList(
    val id: String,
    val title: String,
    val taskCount: Int = 0
)

@JsonClass(generateAdapter = true)
data class AuthResponse(
    val token: String,
    val user: UserInfo
)

@JsonClass(generateAdapter = true)
data class UserInfo(
    val id: String,
    val email: String,
    val name: String? = null
)

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val email: String,
    val password: String
)

@JsonClass(generateAdapter = true)
data class CreateTaskRequest(
    val title: String,
    val listId: String,
    val due: String? = null,
    val notes: String? = null
)

@JsonClass(generateAdapter = true)
data class UpdateTaskRequest(
    val status: String // "open" or "completed"
)

@JsonClass(generateAdapter = true)
data class ApiError(
    val error: String
)
