# Add project specific ProGuard rules here.
-keep class com.taskflow.app.data.model.** { *; }
-keep class com.squareup.moshi.** { *; }
-keepclassmembers class ** {
    @com.squareup.moshi.FromJson *;
    @com.squareup.moshi.ToJson *;
}
