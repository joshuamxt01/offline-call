plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "app.nexa"
    compileSdk = 34

    defaultConfig {
        applicationId = "app.nexa"
        minSdk = 24
        targetSdk = 34
        versionCode = 21
        versionName = "0.3.9"

        // Point the app at your backend. Local dev: the Android emulator reaches
        // the host machine at 10.0.2.2. Override in local.properties / CI.
        val apiBase = (project.findProperty("API_BASE_URL") as String?) ?: "http://10.0.2.2:4000"
        buildConfigField("String", "API_BASE_URL", "\"$apiBase\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // Two apps from one project:
    //   online  -> cloud mode (Socket.IO backend). Ships to users; pushed to GitHub.
    //   offline -> LAN mode (direct sockets, no server). Installs alongside as a
    //              separate package (app.nexa.offline).
    // Shared code lives in src/main; connection code lives in src/online & src/offline.
    flavorDimensions += "mode"
    productFlavors {
        create("online") {
            dimension = "mode"
        }
        create("offline") {
            dimension = "mode"
            applicationIdSuffix = ".offline"
            versionNameSuffix = "-offline"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug {
            // allow cleartext to the local backend during development
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    debugImplementation(libs.androidx.ui.tooling)

    implementation(libs.androidx.navigation.compose)
    implementation(libs.hilt.navigation.compose)

    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    implementation(libs.retrofit)
    implementation(libs.retrofit.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)

    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    implementation(libs.datastore.preferences)
    implementation(libs.security.crypto)

    implementation(libs.socketio) { exclude(group = "org.json", module = "json") }
    implementation(libs.webrtc)

    // lazysodium-android pulls JNA in as a .jar; on Android we need the .aar
    // (it carries the native .so libs). Exclude the transitive jar to avoid
    // "Duplicate class com.sun.jna.*" and add JNA explicitly as an aar.
    implementation(libs.lazysodium.android) {
        exclude(group = "net.java.dev.jna", module = "jna")
    }
    implementation(libs.jna) { artifact { type = "aar" } }

    implementation(libs.coil.compose)
    implementation(libs.accompanist.permissions)

    // CameraX — in-app video-note recorder with front/back flip
    implementation(libs.androidx.camera.core)
    implementation(libs.androidx.camera.camera2)
    implementation(libs.androidx.camera.lifecycle)
    implementation(libs.androidx.camera.video)
    implementation(libs.androidx.camera.view)
}
