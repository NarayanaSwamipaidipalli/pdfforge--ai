package com.pdfforge.ai.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class MobilePdfTool(
    val id: String,
    val name: String,
    val category: String,
    val icon: ImageVector,
    val color: Color
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFFFBFBFD)
                ) {
                    PdfForgeMobileScreen()
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PdfForgeMobileScreen() {
    var selectedTab by remember { mutableStateOf(0) }

    val tools = listOf(
        MobilePdfTool("scan", "Document Scanner", "AI", Icons.Default.CameraAlt, Color(0xFF3B82F6)),
        MobilePdfTool("compress", "Compress PDF", "Core", Icons.Default.Compress, Color(0xFF10B981)),
        MobilePdfTool("merge", "Merge PDFs", "Core", Icons.Default.Layers, Color(0xFF6366F1)),
        MobilePdfTool("ai_chat", "Chat with PDF", "AI", Icons.Default.SmartToy, Color(0xFF8B5CF6)),
        MobilePdfTool("convert", "PDF to Word", "Convert", Icons.Default.Description, Color(0xFFF59E0B)),
        MobilePdfTool("sign", "Sign Document", "Security", Icons.Default.Draw, Color(0xFFEF4444)),
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "PDFForge AI",
                            fontSize = 20.sp,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                            color = Color(0xFF1D1D1F)
                        )
                    }
                },
                actions = {
                    IconButton(onClick = {}) {
                        Icon(Icons.Default.CloudSync, contentDescription = "Sync", tint = Color(0xFF3B82F6))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color.White) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Home, contentDescription = "Tools") },
                    label = { Text("Tools") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.SmartToy, contentDescription = "AI") },
                    label = { Text("AI Studio") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.Folder, contentDescription = "Files") },
                    label = { Text("My Files") }
                )
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            // Scanner Quick Action Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 20.dp),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Row(
                    modifier = Modifier.padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(54.dp)
                            .background(
                                Brush.linearGradient(listOf(Color(0xFF2563EB), Color(0xFF4F46E5))),
                                RoundedCornerShape(16.dp)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.DocumentScanner, contentDescription = null, tint = Color.White)
                    }
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("HD Document Scanner", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, fontSize = 16.sp)
                        Text("Auto-crop & AI OCR enhancement", fontSize = 12.sp, color = Color.Gray)
                    }
                    Button(
                        onClick = { /* Launch Camera Scan */ },
                        shape = RoundedCornerShape(20.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1D1D1F))
                    ) {
                        Text("Scan", fontSize = 12.sp)
                    }
                }
            }

            Text(
                "PDF Tool Suite",
                fontSize = 16.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(tools) { tool ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Box(
                                modifier = Modifier
                                    .size(42.dp)
                                    .background(tool.color.copy(alpha = 0.12f), RoundedCornerShape(12.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(tool.icon, contentDescription = null, tint = tool.color)
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(tool.name, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, fontSize = 14.sp)
                            Text(tool.category, fontSize = 11.sp, color = Color.Gray)
                        }
                    }
                }
            }
        }
    }
}
