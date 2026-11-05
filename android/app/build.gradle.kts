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
}
