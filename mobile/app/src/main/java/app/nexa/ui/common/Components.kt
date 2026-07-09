package app.nexa.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.nexa.ui.theme.Indigo
import app.nexa.ui.theme.Teal

@Composable
fun Avatar(name: String?, size: Dp = 44.dp, online: Boolean? = null, modifier: Modifier = Modifier) {
    Box(modifier = modifier.size(size), contentAlignment = Alignment.Center) {
        Box(
            modifier = Modifier
                .size(size)
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(Indigo, Teal))),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials(name),
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
                fontSize = (size.value * 0.4f).sp,
            )
        }
        if (online != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .size(size * 0.28f)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surface),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier = Modifier
                        .size(size * 0.2f)
                        .clip(CircleShape)
                        .background(if (online) app.nexa.ui.theme.Success else MaterialTheme.colorScheme.onSurfaceVariant),
                )
            }
        }
    }
}

private fun initials(name: String?): String {
    if (name.isNullOrBlank()) return "?"
    val parts = name.trim().split(" ")
    return (parts.getOrNull(0)?.firstOrNull()?.toString() ?: "") +
        (parts.getOrNull(1)?.firstOrNull()?.toString() ?: "")
}

fun Modifier.clickableNoRipple(onClick: () -> Unit): Modifier = composed {
    val interaction = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    clickable(
        interactionSource = interaction,
        indication = null,
    ) { onClick() }
}
