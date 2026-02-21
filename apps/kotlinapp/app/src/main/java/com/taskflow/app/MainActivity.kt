package com.taskflow.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Today
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.taskflow.app.ui.screens.TodayScreen
import com.taskflow.app.ui.theme.*
import dagger.hilt.android.AndroidEntryPoint

sealed class Screen(val route: String, val label: String, val icon: ImageVector) {
    object Today : Screen("today", "Today", Icons.Default.Today)
    object Someday : Screen("someday", "Someday", Icons.Default.CalendarToday)
    object Overview : Screen("overview", "Overview", Icons.Default.Apps)
}

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TaskFlowMainApp()
        }
    }
}

@Composable
private fun TaskFlowMainApp() {
    com.taskflow.app.ui.theme.TaskFlowTheme {
        val navController = rememberNavController()
        val screens = listOf(Screen.Today, Screen.Someday, Screen.Overview)

        Scaffold(
            containerColor = Background,
            bottomBar = {
                NavigationBar(
                    containerColor = NavBackground,
                    tonalElevation = 0.dp,
                    modifier = Modifier.navigationBarsPadding()
                ) {
                    val navBackStackEntry by navController.currentBackStackEntryAsState()
                    val currentDestination = navBackStackEntry?.destination

                    screens.forEach { screen ->
                        val selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = {
                                Icon(
                                    screen.icon,
                                    contentDescription = screen.label,
                                    tint = if (selected) NavSelected else NavUnselected
                                )
                            },
                            label = {
                                Text(
                                    screen.label,
                                    color = if (selected) NavSelected else NavUnselected,
                                    fontSize = 10.sp
                                )
                            },
                            colors = NavigationBarItemDefaults.colors(
                                indicatorColor = AccentTealDim
                            )
                        )
                    }
                }
            }
        ) { innerPadding ->
            NavHost(
                navController = navController,
                startDestination = Screen.Today.route,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .background(Background)
            ) {
                composable(Screen.Today.route) { TodayScreen() }
                composable(Screen.Someday.route) { PlaceholderScreen("Someday") }
                composable(Screen.Overview.route) { PlaceholderScreen("Overview") }
            }
        }
    }
}

@Composable
private fun PlaceholderScreen(title: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Background),
        contentAlignment = androidx.compose.ui.Alignment.Center
    ) {
        Text(title, color = TextSecondary, fontSize = 18.sp)
    }
}
