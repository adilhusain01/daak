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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
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

/** The app's one language, Hindi or English, chosen on the Me tab (and at sign-in); it starts as the phone's own. */
object Lang { var hindi by androidx.compose.runtime.mutableStateOf(java.util.Locale.getDefault().language == "hi") }
fun pick(hi: String, en: String) = if (Lang.hindi) hi else en

private val deva = Regex("[\\u0900-\\u097F]")
private val latin = Regex("[A-Za-z]")
/**
 * Keeps one language of a line written in both: "हिंदी · English" pairs, or "हिंदी वाक्य। English sentence."
 * Parts in neither pair (a code, a number, an English-only line) stay as they are.
 */
fun t(s: String): String {
    val parts = s.split(" · ")
    if (parts.size >= 2) {
        val out = mutableListOf<String>()
        var i = 0
        while (i < parts.size) {
            val p = parts[i]
            if (deva.containsMatchIn(p) && i + 1 < parts.size && latin.containsMatchIn(parts[i + 1]) && !deva.containsMatchIn(parts[i + 1])) { out += pick(p, parts[i + 1]); i += 2 }
            else { out += p; i++ }
        }
        return out.joinToString(" · ")
    }
    val k = s.lastIndexOf("।")
    if (k in 0 until s.length - 1) {
        val en = s.substring(k + 1).trim()
        if (latin.containsMatchIn(en) && !deva.containsMatchIn(en)) return pick(s.substring(0, k + 1).trim(), en)
    }
    return s
}

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
    BasicText(t(text), style = TextStyle(fontSize = size.sp, lineHeight = (size * 1.35).sp, color = color, fontWeight = weight))

/** A line in the chosen language. */
@Composable
fun Bi(hi: String, en: String, color: Color = Tokens.ink, size: Int = 20) = Body(pick(hi, en), color, size, FontWeight.SemiBold)

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
            BasicText(if (en != null) pick(hi, en) else t(hi), style = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.SemiBold, color = Tokens.paper))
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
    ) { BasicText(t(text), style = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.Medium, color = Tokens.ink)) }
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
            Body(pick(hi, en), if (done == null && !active) Tokens.muted else Tokens.ink, 19, FontWeight.SemiBold)
            if (done != null) Body(done, Tokens.green, 15)
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
        BasicText(pick(hi, en), style = TextStyle(fontSize = 30.sp, fontWeight = FontWeight.Bold, color = Tokens.paper))
        if (!detail.isNullOrBlank()) BasicText(t(detail), style = TextStyle(fontSize = 16.sp, lineHeight = 22.sp, color = Tokens.paper.copy(alpha = 0.85f)))
    }
}

/** A labelled text box for the join form: sits in (a tray), never pressed. */
@Composable
fun Field(label: String, value: String, onChange: (String) -> Unit, hint: String = "", number: Boolean = false) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Body(label, Tokens.muted, 15)
        Box(Modifier.fillMaxWidth().background(Tokens.tray, RoundedCornerShape(Tokens.radius)).padding(6.dp)
            .background(Tokens.sheet, RoundedCornerShape(Tokens.inner)).border(1.dp, Tokens.line, RoundedCornerShape(Tokens.inner)).padding(14.dp)) {
            androidx.compose.foundation.text.BasicTextField(
                value = value, onValueChange = onChange, singleLine = true,
                textStyle = TextStyle(fontSize = 19.sp, color = Tokens.ink),
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = if (number) androidx.compose.ui.text.input.KeyboardType.Phone else androidx.compose.ui.text.input.KeyboardType.Text),
                modifier = Modifier.fillMaxWidth(),
                decorationBox = { inner -> if (value.isEmpty()) BasicText(hint, style = TextStyle(fontSize = 19.sp, color = Tokens.muted)); inner() },
            )
        }
    }
}

/** One choice in a list of equal choices: chosen ones sit in with a green edge, the rest can be pressed. */
@Composable
fun Choice(title: String, sub: String?, chosen: Boolean, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    Column(
        Modifier.fillMaxWidth()
            .graphicsLayer { val s = if (pressed) 0.97f else 1f; scaleX = s; scaleY = s }
            .then(if (chosen) Modifier else Modifier.shadow(2.dp, RoundedCornerShape(Tokens.radius)))
            .background(if (chosen) Tokens.tray else Tokens.sheet, RoundedCornerShape(Tokens.radius))
            .border(if (chosen) 2.dp else 1.dp, if (chosen) Tokens.green else Tokens.line, RoundedCornerShape(Tokens.radius))
            .clickable(interactionSource = source, indication = null, onClick = onClick)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Body((if (chosen) "✓ " else "") + title, Tokens.ink, 19, FontWeight.SemiBold)
        if (sub != null) Body(sub, Tokens.muted, 15)
    }
}

/** A section's heading inside a sheet: Hindi, with English beside it in a lighter tone. */
@Composable
fun Heading(hi: String, en: String) {
    Body(pick(hi, en), Tokens.ink, 19, FontWeight.SemiBold)
}

/** A row of numbers that matter at a glance; each sits in a tray, read and never pressed. */
@Composable
fun Stats(items: List<Pair<String, String>>) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items.forEach { (value, label) ->
            Column(
                Modifier.weight(1f).background(Tokens.tray, RoundedCornerShape(Tokens.inner)).padding(horizontal = 12.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Body(value, Tokens.ink, 22, FontWeight.SemiBold)
                Body(label, Tokens.muted, 13)
            }
        }
    }
}

/** A label on the left and its value on the right, on one line. */
@Composable
fun Line(label: String, value: String, valueColor: Color = Tokens.ink, big: Boolean = false) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Body(label, Tokens.muted, 16)
        Body(value, valueColor, if (big) 24 else 17, FontWeight.SemiBold)
    }
}

/** How far along something is: a filled bar in a tray. */
@Composable
fun Progress(fraction: Float, color: Color = Tokens.green) {
    Box(Modifier.fillMaxWidth().height(8.dp).background(Tokens.tray, RoundedCornerShape(4.dp))) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0.02f, 1f)).height(8.dp).background(color, RoundedCornerShape(4.dp)))
    }
}

/** A setting that is on or off: pressable, with its state written in words on the right. */
@Composable
fun Toggle(hi: String, en: String, on: Boolean, busy: Boolean = false, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    Row(
        Modifier.fillMaxWidth()
            .graphicsLayer { val s = if (pressed) 0.97f else 1f; scaleX = s; scaleY = s }
            .shadow(2.dp, RoundedCornerShape(Tokens.radius))
            .background(Tokens.sheet, RoundedCornerShape(Tokens.radius))
            .clickable(interactionSource = source, indication = null, enabled = !busy, onClick = onClick)
            .padding(horizontal = Tokens.pad, vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Body(hi, Tokens.ink, 18, FontWeight.SemiBold)
            Body(en, Tokens.muted, 14)
        }
        Box(
            Modifier.background(if (on) Tokens.green else Tokens.tray, RoundedCornerShape(8.dp)).padding(horizontal = 12.dp, vertical = 6.dp),
        ) { Body(if (busy) "…" else if (on) "चालू · On" else "बंद · Off", if (on) Tokens.paper else Tokens.muted, 14, FontWeight.SemiBold) }
    }
}

/** The quietest key: text only, for things done rarely (switching badge, going back). */
@Composable
fun TextKey(text: String, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    Box(
        Modifier.fillMaxWidth().graphicsLayer { alpha = if (pressed) 0.6f else 1f }
            .clickable(interactionSource = source, indication = null, onClick = onClick).padding(vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) { Body(text, Tokens.muted, 16, FontWeight.Medium) }
}

/** A hairline between items in a sheet. */
@Composable
fun Rule() = Box(Modifier.fillMaxWidth().height(1.dp).background(Tokens.line))

/** One destination in the tab bar: a short Hindi word and its English under it. */
data class TabItem(val id: String, val hi: String, val en: String)

/**
 * The tab bar: a segmented switch pinned above the system navigation bar. One tray, equal segments, the current one
 * filled in ink (it sits in: you are here), the others plain and pressable. The fill slides to a new segment with a
 * short ease-out and snaps when the phone has animations turned off. Labels are always shown; every segment is at
 * least 56 dp tall; screen readers hear it as a set of tabs.
 */
@Composable
fun SegmentedTabs(items: List<TabItem>, selected: String, onSelect: (TabItem) -> Unit) {
    val view = androidx.compose.ui.platform.LocalView.current
    val reduced = remember {
        android.provider.Settings.Global.getFloat(view.context.contentResolver, android.provider.Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
    val index = items.indexOfFirst { it.id == selected }.coerceAtLeast(0)
    Box(
        Modifier.fillMaxWidth().background(Tokens.paper)
            .padding(start = Tokens.pad, end = Tokens.pad, top = 8.dp, bottom = 10.dp),
    ) {
        androidx.compose.foundation.layout.BoxWithConstraints(
            Modifier.fillMaxWidth().background(Tokens.tray, RoundedCornerShape(Tokens.radius)).padding(6.dp),
        ) {
            val segment = maxWidth / items.size
            val x by androidx.compose.animation.core.animateDpAsState(
                targetValue = segment * index,
                animationSpec = if (reduced) androidx.compose.animation.core.snap()
                else androidx.compose.animation.core.tween(200, easing = androidx.compose.animation.core.CubicBezierEasing(0.2f, 0f, 0f, 1f)),
                label = "tab",
            )
            Box(
                Modifier.offset(x = x).width(segment).height(56.dp)
                    .background(Tokens.ink, RoundedCornerShape(Tokens.inner)),
            )
            Row(Modifier.fillMaxWidth().selectableGroup()) {
                items.forEachIndexed { i, item ->
                    val on = i == index
                    val source = remember { MutableInteractionSource() }
                    val pressed by source.collectIsPressedAsState()
                    Column(
                        Modifier.weight(1f).height(56.dp)
                            .graphicsLayer { val s = if (pressed && !on) 0.95f else 1f; scaleX = s; scaleY = s }
                            .selectable(selected = on, interactionSource = source, indication = null, role = androidx.compose.ui.semantics.Role.Tab) {
                                view.performHapticFeedback(
                                    if (android.os.Build.VERSION.SDK_INT >= 34) android.view.HapticFeedbackConstants.SEGMENT_TICK
                                    else android.view.HapticFeedbackConstants.CLOCK_TICK,
                                )
                                onSelect(item)
                            },
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        BasicText(pick(item.hi, item.en), style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = if (on) Tokens.paper else Tokens.ink))
                    }
                }
            }
        }
    }
}

/** A parcel in a list: it casts a shadow because it opens; code and progress on top, its state in colour, the route below. */
@Composable
fun ParcelItem(code: String, trailing: String, status: String, statusColor: Color, sub: String, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    Column(
        Modifier.fillMaxWidth()
            .graphicsLayer { val s = if (pressed) 0.98f else 1f; scaleX = s; scaleY = s }
            .shadow(2.dp, RoundedCornerShape(Tokens.radius))
            .background(Tokens.sheet, RoundedCornerShape(Tokens.radius))
            .border(1.dp, Tokens.line, RoundedCornerShape(Tokens.radius))
            .clickable(interactionSource = source, indication = null, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Body(code, Tokens.ink, 18, FontWeight.Bold)
            Body(trailing, Tokens.ink, 16, FontWeight.Medium)
        }
        Body(status, statusColor, 16, FontWeight.Medium)
        Body(sub, Tokens.muted, 14)
    }
}

/** A key that sits beside another in a row: filled for the main choice, edged for the other. */
@Composable
fun SmallKey(text: String, modifier: Modifier = Modifier, color: Color = Tokens.ink, filled: Boolean = true, sub: String? = null, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    Box(
        modifier
            .graphicsLayer { val s = if (pressed) 0.97f else 1f; scaleX = s; scaleY = s }
            .shadow(if (filled) 4.dp else 2.dp, RoundedCornerShape(Tokens.inner))
            .background(if (filled) color else Tokens.sheet, RoundedCornerShape(Tokens.inner))
            .border(1.dp, if (filled) color else Tokens.line, RoundedCornerShape(Tokens.inner))
            .clickable(interactionSource = source, indication = null, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            BasicText(t(text), style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = if (filled) Tokens.paper else Tokens.ink))
            if (sub != null) BasicText(sub, style = TextStyle(fontSize = 13.sp, color = if (filled) Tokens.paper.copy(alpha = 0.8f) else Tokens.muted))
        }
    }
}

/** Daak's mark: ड, the first letter of डाक, in amber on a square, beside the name. The same mark as the website. */
@Composable
fun Brand() {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(38.dp).background(Tokens.amber, RoundedCornerShape(Tokens.inner)), contentAlignment = Alignment.Center) {
            BasicText("ड", style = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Tokens.paper))
        }
        Column {
            BasicText("Daak", style = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.SemiBold, color = Tokens.ink, lineHeight = 26.sp))
            BasicText(pick("डाक · हर पार्सल का हिसाब", "Every parcel handoff on record"), style = TextStyle(fontSize = 13.sp, color = Tokens.muted))
        }
    }
}
