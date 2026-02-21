package com.taskflow.app.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.taskflow.app.data.model.Task
import com.taskflow.app.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

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

    Box(modifier = Modifier.fillMaxSize().background(Background)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 100.dp)
        ) {
            // ── Top Bar ───────────────────────────────────────────────────────
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Settings,
                        contentDescription = "Settings",
                        tint = TextSecondary,
                        modifier = Modifier.size(22.dp)
                    )
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 12.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(SurfaceCard)
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Search", color = TextTertiary, fontSize = 14.sp)
                    }
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(SurfaceCard),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.Person,
                            contentDescription = "Profile",
                            tint = TextSecondary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

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

            // ── Upcoming Focus Card ───────────────────────────────────────────
            item {
                UpcomingFocusCard(uiState.tasks.take(3))
            }

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

        // ── FAB ───────────────────────────────────────────────────────────────
        FloatingActionButton(
            onClick = { /* open add task sheet */ },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(24.dp),
            containerColor = AccentTeal,
            contentColor = Background
        ) {
            Icon(Icons.Default.Add, contentDescription = "Add task")
        }
    }

    // ── Task Detail Bottom Sheet ──────────────────────────────────────────────
    selectedTask?.let { task ->
        TaskDetailSheet(task = task, onDismiss = { selectedTask = null })
    }
}

@Composable
private fun UpcomingFocusCard(tasks: List<Task>) {
    Box(
        modifier = Modifier
            .padding(horizontal = 20.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(
                Brush.linearGradient(
                    colors = listOf(Color(0xFF2D1B4E), Color(0xFF1B2D4E))
                )
            )
            .padding(20.dp)
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Upcoming focus",
                    style = MaterialTheme.typography.titleMedium,
                    color = TextPrimary
                )
                Text(
                    "${tasks.size} tasks",
                    style = MaterialTheme.typography.bodySmall,
                    color = AccentTeal
                )
            }
            Spacer(modifier = Modifier.height(12.dp))

            val taskColors = listOf(TaskPink, TaskPurple, TaskIndigo)
            tasks.forEachIndexed { idx, task ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 3.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .width(3.dp)
                            .height(28.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(taskColors.getOrElse(idx) { AccentTeal })
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(task.title, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        task.due?.let {
                            Text(it, color = TextTertiary, fontSize = 11.sp)
                        }
                    }
                }
            }

            if (tasks.isEmpty()) {
                Text("No upcoming tasks! 🎉", color = TextTertiary, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun TaskRow(task: Task, onToggle: () -> Unit, onClick: () -> Unit) {
    val bgColor = when {
        task.tags.contains("Work") -> Color(0xFF1A1A2E)
        task.tags.contains("Shopping") -> Color(0xFF2B1A1A)
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
