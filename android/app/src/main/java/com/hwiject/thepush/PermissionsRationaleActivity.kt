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

class PermissionsRationaleActivity : Activity() {
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

        container.addView(titleText("더푸시 Health Connect 권한 안내"))
        container.addView(bodyText("더푸시는 사용자가 선택한 인증 기록의 근거를 만들기 위해 Health Connect 데이터를 사용할 수 있습니다."))
        container.addView(bodyText("현재 테스트 단계에서는 걸음 수 읽기 권한만 요청합니다. 더푸시는 이 권한을 사용해 사용자가 직접 선택한 날짜의 걸음 수를 인증 근거로 첨부할 수 있게 할 예정입니다."))
        container.addView(bodyText("이 단계에서는 실제 걸음 수 데이터를 자동으로 읽거나 서버로 전송하지 않습니다. 연결 여부와 권한 상태만 앱 안에 저장합니다."))
        container.addView(bodyText("나중에 운동 기록, 이동 거리, 칼로리, 수면, 심박, 체중 등은 각각 별도 권한과 설명을 추가한 뒤 확장합니다."))

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
        setLineSpacing(4f, 1.0f)
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
