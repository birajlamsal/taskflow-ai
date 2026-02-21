package com.taskflow.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.taskflow.app.data.model.Task
import com.taskflow.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskDetailSheet(task: Task, onDismiss: () -> Unit) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = SurfaceCard,
        tonalElevation = 0.dp,
        dragHandle = {
            Box(
                modifier = Modifier.padding(top = 12.dp, bottom = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .width(40.dp)
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(SurfaceElevated)
                )
            }
        }
    ) {
        Column(modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp)) {
            // ── Header ────────────────────────────────────────────────────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onDismiss) {
                    Text("Cancel", color = TextSecondary, fontSize = 15.sp)
                }
                TextButton(onClick = onDismiss) {
                    Text("Done", color = AccentTeal, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            // ── Title ─────────────────────────────────────────────────────────
            Text(
                task.title,
                style = MaterialTheme.typography.displayMedium.copy(fontSize = 26.sp),
                color = TextPrimary,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            // ── Tags ──────────────────────────────────────────────────────────
            if (task.tags.isNotEmpty()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(bottom = 20.dp)
                ) {
                    task.tags.forEach { tag ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(AccentTealDim)
                                .padding(horizontal = 12.dp, vertical = 5.dp)
                        ) {
                            Text(tag, color = AccentTeal, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(SurfaceElevated)
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "Add tag", tint = TextSecondary, modifier = Modifier.size(14.dp))
                    }
                }
            }

            // ── Notes ─────────────────────────────────────────────────────────
            if (!task.notes.isNullOrBlank()) {
                Text(
                    task.notes,
                    color = TextSecondary,
                    fontSize = 15.sp,
                    lineHeight = 22.sp,
                    modifier = Modifier.padding(bottom = 20.dp)
                )
            } else {
                Text(
                    "Add notes...",
                    color = TextTertiary,
                    fontSize = 15.sp,
                    modifier = Modifier.padding(bottom = 20.dp)
                )
            }

            Divider(color = SurfaceElevated)
            Spacer(modifier = Modifier.height(16.dp))

            // ── Quick Actions Grid ────────────────────────────────────────────
            val actions = listOf(
                Pair(Icons.Default.AttachFile, "Attachments"),
                Pair(Icons.Default.List, "Subtasks"),
                Pair(Icons.Default.ChatBubbleOutline, "Comments"),
                Pair(Icons.Default.CalendarToday, "Date & Time"),
                Pair(Icons.Default.Palette, "Color"),
                Pair(Icons.Default.Notifications, "Notification")
            )

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                actions.chunked(3).forEach { rowActions ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        rowActions.forEach { (icon, label) ->
                            QuickActionButton(
                                icon = { Icon(icon, contentDescription = label, tint = TextSecondary, modifier = Modifier.size(22.dp)) },
                                label = label,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        repeat(3 - rowActions.size) {
                            Spacer(modifier = Modifier.weight(1f))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun QuickActionButton(
    icon: @Composable () -> Unit,
    label: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceCard2)
            .padding(vertical = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        icon()
        Spacer(modifier = Modifier.height(6.dp))
        Text(label, color = TextTertiary, fontSize = 10.sp, fontWeight = FontWeight.Medium)
    }
}
