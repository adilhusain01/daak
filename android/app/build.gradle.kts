plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.adilhusain.daak"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.adilhusain.daak"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        // Backend base URL. Debug builds talk to the laptop over `adb reverse tcp:3000 tcp:3000`.
        buildConfigField("String", "API_BASE", "\"http://127.0.0.1:3000\"")
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
