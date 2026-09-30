# Keep the WebView bridge intact. Capacitor reflects over these entry points and
# R8 cannot see the references from JavaScript.
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.plugin.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}

# Kotlin metadata used by the plugin loader.
-keepattributes *Annotation*, InnerClasses, Signature, RuntimeVisible*Annotations
