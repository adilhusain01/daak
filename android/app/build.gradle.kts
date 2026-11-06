import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

// The app key lives in local.properties (not in git), so the APK can call the backend's app-only endpoints.
val localProps = Properties().apply { rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use(::load) }

android {
    namespace = "com.adilhusain.daak"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.adilhusain.daak"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        // Backend base URL: the deployed web app. Use http://127.0.0.1:3000 with `adb reverse tcp:3000 tcp:3000` for local work.
        buildConfigField("String", "APP_KEY", "\"${localProps.getProperty("daakAppKey", "")}\"")
        buildConfigField("String", "API_BASE", "\"https://daak-ethglobal.vercel.app\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.09.00"))
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.activity:activity-compose:1.13.0")
    // The other person's code at a handoff: drawn with ZXing, scanned with Google's code scanner (no camera permission).
    implementation("com.google.zxing:core:3.5.3")
    // Continue with Google: Credential Manager and Google ID tokens; the server verifies the token.
    implementation("androidx.credentials:credentials:1.5.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.5.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")
    // Turning location on from inside the app: the system "Turn on location?" window, no trip to Settings.
    implementation("com.google.android.gms:play-services-location:21.3.0")
}
