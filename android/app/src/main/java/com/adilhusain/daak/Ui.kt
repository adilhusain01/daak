package com.adilhusain.daak

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** One set of tokens for every screen: the same paper and ink as the website. */
object Tokens {
    val paper = Color(0xFFF7F3EA)
    val sheet = Color(0xFFFFFDF8)
    val tray = Color(0xFFEFE9DC)
    val ink = Color(0xFF1F2A44)
    val muted = Color(0xFF6B6F7A)
    val line = Color(0xFFE2DBCB)
    val green = Color(0xFF2E7D4F)
    val amber = Color(0xFFB7791F)
    val red = Color(0xFFB23A3A)
    val radius = 16.dp
    val inner = 10.dp // radius minus the 6dp padding of a tray: concentric corners
    val pad = 20.dp
}

@Composable
fun Title(text: String) =
    BasicText(text, style = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.SemiBold, color = Tokens.ink))

@Composable
fun Body(text: String, color: Color = Tokens.ink, size: Int = 18, weight: FontWeight = FontWeight.Normal) =
    BasicText(text, style = TextStyle(fontSize = size.sp, lineHeight = (size * 1.35).sp, color = color, fontWeight = weight))

/** Hindi first, English under it, for every line a driver needs to read. */
@Composable
fun Bi(hi: String, en: String, color: Color = Tokens.ink, size: Int = 20) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Body(hi, color, size, FontWeight.SemiBold)
        Body(en, if (color == Tokens.ink) Tokens.muted else color.copy(alpha = 0.8f), size - 4)
    }
}

/** A key: casts a shadow, so it can be pressed. Shrinks a little on press, at once. */
@Composable
fun Action(hi: String, en: String? = null, color: Color = Tokens.ink, enabled: Boolean = true, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    Box(
        Modifier.fillMaxWidth()
            .graphicsLayer { val s = if (pressed) 0.97f else 1f; scaleX = s; scaleY = s; alpha = if (enabled) 1f else 0.45f }
            .shadow(if (enabled) 6.dp else 0.dp, RoundedCornerShape(Tokens.radius))
            .background(color, RoundedCornerShape(Tokens.radius))
            .clickable(interactionSource = source, indication = null, enabled = enabled, onClick = onClick)
            .padding(horizontal = Tokens.pad, vertical = 18.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            BasicText(hi, style = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.SemiBold, color = Tokens.paper))
            if (en != null) BasicText(en, style = TextStyle(fontSize = 16.sp, color = Tokens.paper.copy(alpha = 0.8f)))
        }
    }
}

/** A quieter key for the second choice on a screen. */
@Composable
fun Secondary(text: String, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    Box(
        Modifier.fillMaxWidth()
            .graphicsLayer { val s = if (pressed) 0.97f else 1f; scaleX = s; scaleY = s }
            .shadow(2.dp, RoundedCornerShape(Tokens.radius))
            .background(Tokens.sheet, RoundedCornerShape(Tokens.radius))
            .clickable(interactionSource = source, indication = null, onClick = onClick)
            .padding(horizontal = Tokens.pad, vertical = 14.dp),
    ) { BasicText(text, style = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.Medium, color = Tokens.ink)) }
}

/** A sheet: read, never pressed. Flat, an edge, no shadow. */
@Composable
fun Sheet(content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxWidth().background(Tokens.sheet, RoundedCornerShape(Tokens.radius))
            .border(1.dp, Tokens.line, RoundedCornerShape(Tokens.radius)).padding(Tokens.pad),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) { content() }
}

/** One step of a flow: done (green tick), the current one (ink edge), or still to come (muted). */
@Composable
fun Step(n: Int, hi: String, en: String, done: String?, active: Boolean) {
    val edge = when { done != null -> Tokens.green; active -> Tokens.ink; else -> Tokens.line }
    Row(
        Modifier.fillMaxWidth().background(Tokens.tray, RoundedCornerShape(Tokens.radius)).padding(6.dp)
            .background(Tokens.sheet, RoundedCornerShape(Tokens.inner)).border(if (active) 2.dp else 1.dp, edge, RoundedCornerShape(Tokens.inner))
            .padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(34.dp).background(if (done != null) Tokens.green else if (active) Tokens.ink else Tokens.line, RoundedCornerShape(8.dp)),
            contentAlignment = Alignment.Center,
        ) { BasicText(if (done != null) "✓" else "$n", style = TextStyle(fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Tokens.paper)) }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Body(hi, if (done == null && !active) Tokens.muted else Tokens.ink, 19, FontWeight.SemiBold)
            Body(done ?: en, if (done != null) Tokens.green else Tokens.muted, 15)
        }
    }
}

/** The answer after a handoff or booking: a full-width colour block that reads from across a bus stand. */
@Composable
fun Verdict(color: Color, hi: String, en: String, detail: String?) {
    Column(
        Modifier.fillMaxWidth().background(color, RoundedCornerShape(Tokens.radius)).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        BasicText(hi, style = TextStyle(fontSize = 30.sp, fontWeight = FontWeight.Bold, color = Tokens.paper))
        BasicText(en, style = TextStyle(fontSize = 18.sp, color = Tokens.paper.copy(alpha = 0.9f)))
        if (!detail.isNullOrBlank()) BasicText(detail, style = TextStyle(fontSize = 16.sp, lineHeight = 22.sp, color = Tokens.paper.copy(alpha = 0.85f)))
    }
}
