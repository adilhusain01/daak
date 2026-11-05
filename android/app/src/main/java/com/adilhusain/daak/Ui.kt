package com.adilhusain.daak

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** One set of tokens for every screen. */
object Tokens {
    val paper = Color(0xFFF7F3EA)
    val ink = Color(0xFF1F2A44)
    val muted = Color(0xFF6B6F7A)
    val line = Color(0xFFE2DBCB)
    val green = Color(0xFF2E7D4F)
    val amber = Color(0xFFB7791F)
    val red = Color(0xFFB23A3A)
    val radius = 12.dp
    val pad = 20.dp
}

@Composable
fun Title(text: String) =
    BasicText(text, style = TextStyle(fontSize = 30.sp, fontWeight = FontWeight.SemiBold, color = Tokens.ink))

@Composable
fun Body(text: String, color: Color = Tokens.ink, size: Int = 18) =
    BasicText(text, style = TextStyle(fontSize = size.sp, lineHeight = (size * 1.4).sp, color = color))

/** A raised, pressable block: if it casts a shadow you can press it. */
@Composable
fun Action(label: String, sub: String? = null, color: Color = Tokens.ink, onClick: () -> Unit) {
    Box(
        Modifier.fillMaxWidth()
            .background(color, RoundedCornerShape(Tokens.radius))
            .clickable(onClick = onClick)
            .padding(horizontal = Tokens.pad, vertical = 18.dp),
    ) {
        BasicText(
            if (sub == null) label else "$label\n$sub",
            style = TextStyle(fontSize = 20.sp, lineHeight = 26.sp, fontWeight = FontWeight.Medium, color = Tokens.paper),
        )
    }
}

/** A flat step card: it sits in, you look at it. */
@Composable
fun Step(n: Int, label: String, done: String?, active: Boolean) {
    val border = if (active) Tokens.ink else Tokens.line
    Box(
        Modifier.fillMaxWidth()
            .border(if (active) 2.dp else 1.dp, border, RoundedCornerShape(Tokens.radius))
            .padding(Tokens.pad),
        contentAlignment = Alignment.CenterStart,
    ) {
        Body("$n.  $label" + (done?.let { "\n     $it" } ?: ""), color = if (done != null) Tokens.green else if (active) Tokens.ink else Tokens.muted)
    }
}
