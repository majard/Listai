module.exports = {
  expo: {
    name: "Listai",
    slug: "listai",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "assets/images/*",
      "assets/fonts/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.listai.app"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.listai.app",
      enableProguardInReleaseBuilds: true,
      enableR8: true,
      proguardFiles: ["./proguard-rules.pro"]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-router"
    ],
    extra: {
      router: {
        origin: false
      },
      eas: {
        projectId: "5fe2d67d-c3bb-4de5-b8df-bb346fd96bcc"
      }
    }
  }
}; 