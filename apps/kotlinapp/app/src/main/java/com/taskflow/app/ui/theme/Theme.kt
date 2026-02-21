package com.taskflow.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = AccentTeal,
    onPrimary = Background,
    primaryContainer = AccentTealDim,
    onPrimaryContainer = AccentTeal,
    secondary = TaskPink,
    onSecondary = Background,
    background = Background,
    onBackground = TextPrimary,
    surface = SurfaceCard,
    onSurface = TextPrimary,
    surfaceVariant = SurfaceCard2,
    onSurfaceVariant = TextSecondary,
    outline = SurfaceElevated,
    error = TagPink,
    onError = Background
)

@Composable
fun TaskFlowTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography,
        shapes = Shapes,
        content = content
    )
}
