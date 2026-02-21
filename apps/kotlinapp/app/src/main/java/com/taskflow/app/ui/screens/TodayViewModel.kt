package com.taskflow.app.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.taskflow.app.data.model.Task
import com.taskflow.app.data.model.TaskList
import com.taskflow.app.data.repository.TaskRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TodayUiState(
    val isLoading: Boolean = false,
    val tasks: List<Task> = emptyList(),
    val lists: List<TaskList> = emptyList(),
    val selectedFilter: String = "All",
    val error: String? = null
)

@HiltViewModel
class TodayViewModel @Inject constructor(
    private val repository: TaskRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(TodayUiState())
    val uiState: StateFlow<TodayUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    fun loadData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val tasksResult = repository.getTasks()
            val listsResult = repository.getLists()
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                tasks = tasksResult.getOrDefault(emptyList()),
                lists = listsResult.getOrDefault(emptyList()),
                error = tasksResult.exceptionOrNull()?.message
            )
        }
    }

    fun setFilter(filter: String) {
        _uiState.value = _uiState.value.copy(selectedFilter = filter)
    }

    fun toggleTaskComplete(task: Task) {
        viewModelScope.launch {
            val newStatus = if (task.completed) "open" else "completed"
            repository.updateTask(task.id, task.listId, newStatus)
            loadData()
        }
    }

    val filters = listOf("All", "Work", "Home", "Shopping")

    fun filteredTasks(all: List<Task>, filter: String): List<Task> {
        if (filter == "All") return all
        return all.filter { task ->
            task.tags.any { it.equals(filter, ignoreCase = true) } ||
            task.listName.equals(filter, ignoreCase = true)
        }
    }
}
