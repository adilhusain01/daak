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
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.animation.core.animateFloat
import androidx.compose.ui.graphics.drawscope.rotate

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

/**
 * One set of tokens for every screen, the same as the website's (after Umbra's editorial set): warm cream paper,
 * charcoal ink and one aged gold. Gold marks a proven handoff or money released; gold text uses goldDeep (5:1).
 */
object Tokens {
    val paper = Color(0xFFECE5D3)
    val sheet = Color(0xFFE5DCC6)
    val tray = Color(0xFFDBD1B8)
    val ink = Color(0xFF1C1A14)
    val soft = Color(0xFF4A4537)
    val muted = Color(0xFF6B6551)
    val line = Color(0xFFD0C7AE)
    val gold = Color(0xFFA87E36)
    val goldDeep = Color(0xFF7A5A22)
    val green = Color(0xFF36603F)
    val amber = goldDeep // waiting reads as gold text
    val red = Color(0xFF9A3B2A)
    val radius = 14.dp
    val inner = 8.dp // radius minus the 6dp padding of a tray: concentric corners
    val pad = 20.dp
}

/** Umbra's faces, bundled: Bodoni Moda for display, Mulish for reading, Geist Mono for codes, Tiro Devanagari Hindi for Hindi. */
object Type {
    val sans = FontFamily(
        Font(R.font.mulish_regular, FontWeight.Normal), Font(R.font.mulish_semibold, FontWeight.Medium),
        Font(R.font.mulish_semibold, FontWeight.SemiBold), Font(R.font.mulish_bold, FontWeight.Bold), Font(R.font.mulish_extrabold, FontWeight.ExtraBold),
    )
    val display = FontFamily(Font(R.font.bodoni_moda_medium, FontWeight.Medium), Font(R.font.bodoni_moda_semibold, FontWeight.SemiBold), Font(R.font.bodoni_moda_semibold, FontWeight.Bold))
    val deva = FontFamily(Font(R.font.tiro_devanagari, FontWeight.Normal))
    val mono = FontFamily(Font(R.font.geist_mono_medium, FontWeight.Medium))
    private val hindi = Regex("[\\u0900-\\u097F]")
    /** Hindi lines take Tiro; the rest take Mulish for reading, Bodoni for display. */
    fun body(s: String) = if (hindi.containsMatchIn(s)) deva else sans
    fun head(s: String) = if (hindi.containsMatchIn(s)) deva else display
}

@Composable
fun Title(text: String) =
    BasicText(t(text), style = TextStyle(fontSize = 30.sp, lineHeight = 34.sp, fontWeight = FontWeight.Medium, color = Tokens.ink, fontFamily = Type.head(t(text))))

@Composable
fun Body(text: String, color: Color = Tokens.ink, size: Int = 18, weight: FontWeight = FontWeight.Normal) =
    t(text).let { x -> BasicText(x, style = TextStyle(fontSize = size.sp, lineHeight = (size * 1.4).sp, color = color, fontWeight = weight, fontFamily = Type.body(x))) }

/** A line in the chosen language. */
@Composable
fun Bi(hi: String, en: String, color: Color = Tokens.ink, size: Int = 20) = Body(pick(hi, en), color, size, FontWeight.SemiBold)

/** A key: casts a shadow, so it can be pressed. Shrinks a little on press, at once. */
@Composable
fun Action(hi: String, en: String? = null, color: Color = Tokens.ink, enabled: Boolean = true, busy: Boolean = false, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    Box(
        Modifier.fillMaxWidth()
            .graphicsLayer { val s = if (pressed) 0.97f else 1f; scaleX = s; scaleY = s; alpha = if (enabled) 1f else 0.45f }
            .shadow(if (enabled) 6.dp else 0.dp, RoundedCornerShape(Tokens.radius))
            .background(color, RoundedCornerShape(Tokens.radius))
            .clickable(interactionSource = source, indication = null, enabled = enabled && !busy, onClick = onClick)
            .padding(horizontal = Tokens.pad, vertical = 18.dp),
    ) {
        // Working: the spinner takes the label's place and the key keeps its size.
        Column(Modifier.graphicsLayer { alpha = if (busy) 0f else 1f }, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            (if (en != null) pick(hi, en) else t(hi)).let { x -> BasicText(x, style = TextStyle(fontSize = 21.sp, fontWeight = FontWeight.Bold, color = Tokens.paper, fontFamily = Type.body(x))) }
        }
        if (busy) Box(Modifier.matchParentSize(), contentAlignment = Alignment.Center) { Gather(26.dp, Tokens.paper) }
    }
}

/** A quieter key for the second choice on a screen. */
@Composable
fun Secondary(text: String, busy: Boolean = false, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    Box(
        Modifier.fillMaxWidth()
            .graphicsLayer { val s = if (pressed) 0.97f else 1f; scaleX = s; scaleY = s }
            .shadow(2.dp, RoundedCornerShape(Tokens.radius))
            .background(Tokens.sheet, RoundedCornerShape(Tokens.radius))
            .clickable(interactionSource = source, indication = null, enabled = !busy, onClick = onClick)
            .padding(horizontal = Tokens.pad, vertical = 14.dp),
    ) {
        t(text).let { x -> BasicText(x, Modifier.graphicsLayer { alpha = if (busy) 0f else 1f }, style = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Tokens.ink, fontFamily = Type.body(x))) }
        if (busy) Box(Modifier.matchParentSize(), contentAlignment = Alignment.Center) { Gather(22.dp) }
    }
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
        ) { BasicText(if (done != null) "✓" else "$n", style = TextStyle(fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Tokens.paper, fontFamily = Type.sans)) }
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
        pick(hi, en).let { x -> BasicText(x, style = TextStyle(fontSize = 32.sp, lineHeight = 38.sp, fontWeight = FontWeight.Medium, color = Tokens.paper, fontFamily = Type.head(x))) }
        if (!detail.isNullOrBlank()) t(detail).let { x -> BasicText(x, style = TextStyle(fontSize = 16.sp, lineHeight = 23.sp, color = Tokens.paper.copy(alpha = 0.85f), fontFamily = Type.body(x))) }
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
                textStyle = TextStyle(fontSize = 19.sp, color = Tokens.ink, fontFamily = Type.sans),
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = if (number) androidx.compose.ui.text.input.KeyboardType.Phone else androidx.compose.ui.text.input.KeyboardType.Text),
                modifier = Modifier.fillMaxWidth(),
                decorationBox = { inner -> if (value.isEmpty()) BasicText(hint, style = TextStyle(fontSize = 19.sp, color = Tokens.muted, fontFamily = Type.body(hint))); inner() },
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
                BasicText(value, style = TextStyle(fontSize = 26.sp, lineHeight = 30.sp, fontWeight = FontWeight.Medium, color = Tokens.ink, fontFamily = Type.display))
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
fun Progress(fraction: Float, color: Color = Tokens.gold) {
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
                        pick(item.hi, item.en).let { x -> BasicText(x, style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = if (on) Tokens.paper else Tokens.soft, fontFamily = Type.body(x))) }
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
            BasicText(code, style = TextStyle(fontSize = 17.sp, color = Tokens.ink, fontFamily = Type.mono))
            BasicText(trailing, style = TextStyle(fontSize = 15.sp, color = Tokens.soft, fontFamily = Type.mono))
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
            t(text).let { x -> BasicText(x, style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = if (filled) Tokens.paper else Tokens.ink, fontFamily = Type.body(x))) }
            if (sub != null) BasicText(sub, style = TextStyle(fontSize = 13.sp, color = if (filled) Tokens.paper.copy(alpha = 0.8f) else Tokens.muted, fontFamily = Type.body(sub)))
        }
    }
}

/** Daak's mark: ड, the first letter of डाक, in amber on a square, beside the name. The same mark as the website. */
@Composable
fun Brand() {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(R.drawable.daak_mark), contentDescription = null, modifier = Modifier.size(40.dp))
        Column {
            BasicText("Daak", style = TextStyle(fontSize = 26.sp, fontWeight = FontWeight.SemiBold, color = Tokens.ink, lineHeight = 28.sp, fontFamily = Type.display))
            pick("डाक · हर पार्सल का हिसाब", "Every parcel handoff on record").let { x -> BasicText(x, style = TextStyle(fontSize = 13.sp, color = Tokens.muted, fontFamily = Type.body(x))) }
        }
    }
}

/**
 * loading.dev's Gather, drawn in Compose to match the website: four blocks pulling together, turning a quarter and
 * pushing apart. Still when the phone has animations turned off.
 */
@Composable
fun Gather(size: androidx.compose.ui.unit.Dp = 32.dp, color: Color = Tokens.gold) {
    val view = androidx.compose.ui.platform.LocalView.current
    val reduced = remember { android.provider.Settings.Global.getFloat(view.context.contentResolver, android.provider.Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }
    val t = if (reduced) 0f else {
        val inf = androidx.compose.animation.core.rememberInfiniteTransition(label = "gather")
        inf.animateFloat(0f, 1f, androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(1400, easing = androidx.compose.animation.core.LinearEasing)), label = "t").value
    }
    androidx.compose.foundation.Canvas(Modifier.size(size)) {
        val s = this.size.minDimension
        val block = s * 0.3f
        val ease = { x: Float -> if (x < 0.5f) 4 * x * x * x else 1 - Math.pow((-2.0 * x + 2), 3.0).toFloat() / 2 }
        // Pull in over the first half, push out over the second; turn a quarter on the way.
        val pull = ease(if (t < 0.5f) t * 2 else (1 - t) * 2)
        val spread = s * 0.34f - pull * s * 0.18f
        val c = androidx.compose.ui.geometry.Offset(s / 2, s / 2)
        rotate(90f * ease(t), c) {
            listOf(-1f to -1f, 1f to -1f, -1f to 1f, 1f to 1f).forEach { (dx, dy) ->
                drawRoundRect(color, topLeft = androidx.compose.ui.geometry.Offset(c.x + dx * spread - block / 2, c.y + dy * spread - block / 2),
                    size = androidx.compose.ui.geometry.Size(block, block), cornerRadius = androidx.compose.ui.geometry.CornerRadius(block * 0.32f))
            }
        }
    }
}

/** Waiting for something the screen needs: the spinner in the middle of the space, the words kept for TalkBack. A long wait can say what it is under it. */
@Composable
fun Waiting(label: String, caption: String? = null) {
    Column(
        Modifier.fillMaxWidth().padding(vertical = 40.dp).androidx_semantics(t(label)),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Gather(36.dp)
        if (caption != null) Body(caption, Tokens.muted, 15)
    }
}

private fun Modifier.androidx_semantics(label: String) = this.then(Modifier.semantics(mergeDescendants = true) { contentDescription = label })
