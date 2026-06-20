package com.hwiject.thepush

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class HealthConnectOnboardingActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val scrollView = ScrollView(this)
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(28), dp(24), dp(28))
            setBackgroundColor(Color.WHITE)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        container.addView(titleText("더푸시와 Health Connect 연결"))
        container.addView(bodyText("더푸시는 Health Connect를 통해 건강 데이터를 인증의 근거로 첨부할 수 있도록 준비 중입니다."))
        container.addView(bodyText("현재는 걸음 수 읽기 권한만 테스트합니다. 권한을 허용한 뒤 더푸시 앱에서 '걸음 수 권한 다시 확인'을 눌러 연결 상태를 갱신하세요."))
        container.addView(bodyText("Health Connect 데이터는 사용자의 허용 범위 안에서만 접근할 수 있으며, 언제든지 Android 설정의 Health Connect에서 권한을 해제할 수 있습니다."))

        container.addView(primaryButton("더푸시 열기") {
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                startActivity(launchIntent)
            }
            finish()
        })
        container.addView(secondaryButton("닫기") { finish() })

        scrollView.addView(container)
        setContentView(scrollView)
    }

    private fun titleText(text: String): TextView = TextView(this).apply {
        this.text = text
        textSize = 22f
        setTextColor(Color.rgb(15, 23, 42))
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        setPadding(0, 0, 0, dp(16))
    }

    private fun bodyText(text: String): TextView = TextView(this).apply {
        this.text = text
        textSize = 15f
        lineSpacing = 4f
        setTextColor(Color.rgb(51, 65, 85))
        setPadding(0, 0, 0, dp(14))
    }

    private fun primaryButton(text: String, onClick: () -> Unit): Button = Button(this).apply {
        this.text = text
        textSize = 15f
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.rgb(37, 99, 235))
        gravity = Gravity.CENTER
        setOnClickListener { onClick() }
    }

    private fun secondaryButton(text: String, onClick: () -> Unit): Button = Button(this).apply {
        this.text = text
        textSize = 15f
        setTextColor(Color.rgb(51, 65, 85))
        setOnClickListener { onClick() }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
