# Keep React Native classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jsc.** { *; }
-keep class com.facebook.fabric.** { *; }
-keep class com.facebook.turbomodule.** { *; }

# Keep native methods
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
}

# Keep JavaScript interface
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip <methods>;
    @com.facebook.proguard.annotations.DoNotStrip <fields>;
}

# Keep Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep React Native Fabric
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.react.bridge.** { *; }

# Keep TurboModules
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.turbomodule.core.** { *; }
-keep class com.facebook.react.turbomodule.core.interfaces.** { *; }
-keep class com.facebook.react.turbomodule.core.callbacks.** { *; }
-keep class com.facebook.react.turbomodule.core.delegate.** { *; } 