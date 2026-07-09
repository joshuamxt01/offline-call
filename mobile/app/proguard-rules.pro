# WebRTC
-keep class org.webrtc.** { *; }
# Socket.IO / engine.io
-keep class io.socket.** { *; }
-keep class io.engine.** { *; }
# lazysodium / JNA
-keep class com.goterl.lazysodium.** { *; }
-keep class com.sun.jna.** { *; }
-keepclassmembers class * extends com.sun.jna.** { *; }
# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class **$$serializer { *; }
-keep,includedescriptorclasses class app.nexa.**$$serializer { *; }
-keepclassmembers class app.nexa.** { *** Companion; }
