package com.taskflow.app.data.api

import com.taskflow.app.data.model.*
import retrofit2.http.*

interface TaskFlowApi {

    // Auth
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    // Task Lists
    @GET("lists")
    suspend fun getLists(@Header("Authorization") token: String): List<TaskList>

    // Tasks
    @GET("tasks")
    suspend fun getTasks(
        @Header("Authorization") token: String,
        @Query("listId") listId: String? = null
    ): List<Task>

    @POST("tasks")
    suspend fun createTask(
        @Header("Authorization") token: String,
        @Body request: CreateTaskRequest
    ): Task

    @PATCH("tasks/{id}")
    suspend fun updateTask(
        @Header("Authorization") token: String,
        @Path("id") taskId: String,
        @Body request: UpdateTaskRequest
    ): Task

    @DELETE("tasks/{id}")
    suspend fun deleteTask(
        @Header("Authorization") token: String,
        @Path("id") taskId: String
    )
}
