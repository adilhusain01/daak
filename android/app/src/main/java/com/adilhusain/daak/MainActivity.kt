package com.adilhusain.daak

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {
    private val lastTap = mutableStateOf<Tap?>(null)
    private lateinit var nfc: Nfc

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        nfc = Nfc(this) { lastTap.value = it }
        setContent {
            val tap = lastTap.value
            Column(
                Modifier.fillMaxSize().background(Color(0xFFF7F3EA)).padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                BasicText("Daak", style = TextStyle(fontSize = 40.sp, color = Color(0xFF1F2A44)))
                BasicText(
                    if (tap == null) "Tap a badge or parcel" else "Serial ${tap.uid}\n${tap.text ?: "(empty)"}\nwritable: ${tap.writable}",
                    style = TextStyle(fontSize = 18.sp, color = Color(0xFF1F2A44)),
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        nfc.start()
    }

    override fun onPause() {
        nfc.stop()
        super.onPause()
    }
}
