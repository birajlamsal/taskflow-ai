package com.taskflow.app.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.taskflow.app.data.model.Task
import com.taskflow.app.ui.components.MainAppBar
import com.taskflow.app.ui.theme.AccentTeal
import com.taskflow.app.ui.theme.AccentTealDim
import com.taskflow.app.ui.theme.Background
import com.taskflow.app.ui.theme.SurfaceCard
import com.taskflow.app.ui.theme.SurfaceCard2
import com.taskflow.app.ui.theme.SurfaceElevated
import com.taskflow.app.ui.theme.TextPrimary
import com.taskflow.app.ui.theme.TextSecondary
import com.taskflow.app.ui.theme.TextTertiary
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(
    viewModel: TodayViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val displayedTasks = viewModel.filteredTasks(uiState.tasks, uiState.selectedFilter)
    var selectedTask by remember { mutableStateOf<Task?>(null) }

    val dayFormat = SimpleDateFormat("EEEE", Locale.getDefault())
    val dateFormat = SimpleDateFormat("MMM d", Locale.getDefault())
    val today = Date()
    val dayName = dayFormat.format(today)
    val dateName = dateFormat.format(today)

    Scaffold(
        topBar = { MainAppBar() },
        containerColor = Background,
        floatingActionButton = {
            FloatingActionButton(
                onClick = { /* open add task sheet */ },
                modifier = Modifier.padding(24.dp),
                containerColor = AccentTeal,
                contentColor = Background
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add task")
            }
        }
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(it),
            contentPadding = PaddingValues(bottom = 100.dp)
        ) {

            // ── Date Heading ──────────────────────────────────────────────────
            item {
                Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)) {
                    Text(
                        "Today",
                        style = MaterialTheme.typography.displayMedium,
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "$dateName • $dayName",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                }
            }
            
            item { Spacer(modifier = Modifier.height(16.dp)) }

            // ── To-dos Section ────────────────────────────────────────────────
            item {
                Row(
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "To-dos",
                        style = MaterialTheme.typography.titleLarge,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(SurfaceElevated)
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            "${displayedTasks.size} tasks",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondary
                        )
                    }
                }
            }

            // ── Filter Chips ──────────────────────────────────────────────────
            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(viewModel.filters) { filter ->
                        val isSelected = filter == uiState.selectedFilter
                        val chipBg by animateColorAsState(
                            if (isSelected) AccentTeal else SurfaceCard2,
                            animationSpec = tween(200), label = "chip_bg"
                        )
                        val chipText by animateColorAsState(
                            if (isSelected) Background else TextSecondary,
                            animationSpec = tween(200), label = "chip_text"
                        )
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .background(chipBg)
                                .clickable { viewModel.setFilter(filter) }
                                .padding(horizontal = 16.dp, vertical = 8.dp)
                        ) {
                            Text(
                                filter,
                                color = chipText,
                                fontSize = 13.sp,
                                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            // ── Task Items ────────────────────────────────────────────────────
            items(displayedTasks, key = { it.id }) { task ->
                TaskRow(
                    task = task,
                    onToggle = { viewModel.toggleTaskComplete(task) },
                    onClick = { selectedTask = task }
                )
                Spacer(modifier = Modifier.height(8.dp))
            }

            if (uiState.isLoading) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = AccentTeal, modifier = Modifier.size(28.dp))
                    }
                }
            }
        }
    }

    // ── Task Detail Bottom Sheet ──────────────────────────────────────────────
    selectedTask?.let { task ->
        TaskDetailSheet(task = task, onDismiss = { selectedTask = null })
    }
}

@Composable
private fun TaskRow(task: Task, onToggle: () -> Unit, onClick: () -> Unit) {
    val bgColor = when {
        task.tags.contains("Work") -> SurfaceCard
        task.tags.contains("Shopping") -> SurfaceCard
        else -> SurfaceCard
    }

    Row(
        modifier = Modifier
            .padding(horizontal = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(bgColor)
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(
            onClick = onToggle,
            modifier = Modifier.size(28.dp)
        ) {
            Icon(
                if (task.completed) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
                contentDescription = "Toggle",
                tint = if (task.completed) AccentTeal else TextTertiary,
                modifier = Modifier.size(22.dp)
            )
        }
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                task.title,
                color = if (task.completed) TextTertiary else TextPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                textDecoration = if (task.completed) TextDecoration.LineThrough else null
            )
            task.due?.let {
                Text(it, color = TextTertiary, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
            }
        }
        if (task.tags.isNotEmpty()) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(AccentTealDim)
                    .padding(horizontal = 8.dp, vertical = 3.dp)
            ) {
                Text(task.tags.first(), color = AccentTeal, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
